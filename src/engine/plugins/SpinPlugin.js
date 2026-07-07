/**
 * SpinPlugin — Spin Wheel instant game.
 *
 * Uses existing pure helper from instantGamesService:
 *   pickWeighted
 *
 * Config loaded from DB settings via spin_segments.
 * Bet settlement through the unified WalletSettlement.
 */

import { GamePlugin } from '../GamePlugin.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import * as settingsRepo from '../../db/repositories/settings.js';
import { pickWeighted } from '../../services/instantGamesService.js';

/**
 * Load Spin config from DB settings.
 */
async function getSpinConfig() {
  const [minStake, maxStake, segments] = await Promise.all([
    settingsRepo.getNumber('instant_min_stake', 10),
    settingsRepo.getNumber('instant_max_stake', 1000),
    settingsRepo.get('spin_segments', []),
  ]);
  return { minStake, maxStake, segments };
}

export class SpinPlugin extends GamePlugin {
  constructor() {
    super({
      id: 'spin',
      label: 'Spin Wheel',
      description: 'Spin the wheel and win up to 50× your stake',
      metadata: {
        type: 'instant',
        minStake: 10,
        maxStake: 1000,
      },
    });
  }

  /** @override */
  validate(playerId, input) {
    const { stake } = input;
    const s = Number(stake);
    if (!Number.isFinite(s) || s <= 0) {
      throw new AppError('INVALID_STAKE', 422, 'Invalid stake');
    }
    return { stake: s };
  }

  /** @override */
  async play(playerId, input) {
    const cfg = await getSpinConfig();
    const { stake: s } = this.validate(playerId, input);

    if (!Array.isArray(cfg.segments) || cfg.segments.length === 0) {
      throw new AppError('SPIN_UNAVAILABLE', 503, 'Spin is unavailable');
    }
    if (s < cfg.minStake) {
      throw new AppError('STAKE_TOO_LOW', 422, `Minimum stake is ${cfg.minStake} ETB`);
    }
    if (s > cfg.maxStake) {
      throw new AppError('STAKE_TOO_HIGH', 422, `Maximum stake is ${cfg.maxStake} ETB`);
    }

    const segmentIndex = pickWeighted(cfg.segments, this.rng.next);
    const multiplier = Number(cfg.segments[segmentIndex].mult);
    const payout = Math.round(s * multiplier * 100) / 100;

    const outcome = { segmentIndex, multiplier, segmentCount: cfg.segments.length };
    const { balance } = await this.settle({
      playerId,
      stake: s,
      payout,
      multiplier,
      outcome,
    });

    logger.info('Spin played', { playerId, stake: s, segmentIndex, multiplier, payout });
    return { segmentIndex, multiplier, payout, balance, win: payout > 0 };
  }

  /** @override */
  async getConfig() {
    const cfg = await getSpinConfig();
    return {
      minStake: cfg.minStake,
      maxStake: cfg.maxStake,
      spin: { segments: cfg.segments },
    };
  }
}
