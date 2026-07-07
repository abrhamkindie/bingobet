/**
 * KenoPlugin — Keno instant game.
 *
 * Uses existing pure helpers from instantGamesService:
 *   drawUnique, countHits, kenoMultiplier
 *
 * Config loaded from DB settings via getInstantConfig.
 * Bet settlement through the unified WalletSettlement.
 */

import { GamePlugin } from '../GamePlugin.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import * as settingsRepo from '../../db/repositories/settings.js';
import {
  drawUnique,
  countHits,
  kenoMultiplier,
} from '../../services/instantGamesService.js';

/**
 * Load Keno config from DB settings.
 */
async function getKenoConfig() {
  const [minStake, maxStake, kenoPool, kenoDraw, kenoMaxSpots, paytable] = await Promise.all([
    settingsRepo.getNumber('instant_min_stake', 10),
    settingsRepo.getNumber('instant_max_stake', 1000),
    settingsRepo.getNumber('keno_pool', 40),
    settingsRepo.getNumber('keno_draw', 10),
    settingsRepo.getNumber('keno_max_spots', 8),
    settingsRepo.get('keno_paytable', {}),
  ]);
  return { minStake, maxStake, pool: kenoPool, draw: kenoDraw, maxSpots: kenoMaxSpots, paytable };
}

export class KenoPlugin extends GamePlugin {
  constructor() {
    super({
      id: 'keno',
      label: 'Keno',
      description: 'Pick numbers and match the draw to win',
      metadata: {
        type: 'instant',
        minStake: 10,
        maxStake: 1000,
      },
    });
  }

  /** @override */
  validate(playerId, input) {
    const { stake, picks } = input;

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      throw new AppError('INVALID_PICKS', 422, 'Pick at least one number');
    }
    if (picks.length === 0) {
      throw new AppError('INVALID_PICKS', 422, 'Pick at least one number');
    }

    const unique = [...new Set(picks.map(Number))];
    if (unique.length !== picks.length) {
      throw new AppError('INVALID_PICKS', 422, 'Duplicate numbers');
    }

    const s = Number(stake);
    if (!Number.isFinite(s) || s <= 0) {
      throw new AppError('INVALID_STAKE', 422, 'Invalid stake');
    }

    return { stake: s, picks: unique };
  }

  /** @override */
  async play(playerId, input) {
    const cfg = await getKenoConfig();
    const { stake: s, picks } = this.validate(playerId, input);

    if (picks.length > cfg.maxSpots) {
      throw new AppError('TOO_MANY_SPOTS', 422, `Pick at most ${cfg.maxSpots} numbers`);
    }
    if (s < cfg.minStake) {
      throw new AppError('STAKE_TOO_LOW', 422, `Minimum stake is ${cfg.minStake} ETB`);
    }
    if (s > cfg.maxStake) {
      throw new AppError('STAKE_TOO_HIGH', 422, `Maximum stake is ${cfg.maxStake} ETB`);
    }
    if (picks.some((n) => !Number.isInteger(n) || n < 1 || n > cfg.pool)) {
      throw new AppError('INVALID_PICKS', 422, `Numbers must be between 1 and ${cfg.pool}`);
    }

    const drawn = drawUnique(cfg.pool, cfg.draw, this.rng.next);
    const hits = countHits(picks, drawn);
    const multiplier = kenoMultiplier(cfg.paytable, picks.length, hits);
    const payout = Math.round(s * multiplier * 100) / 100;

    const outcome = { picks, drawn, hits, spots: picks.length };
    const { balance } = await this.settle({
      playerId,
      stake: s,
      payout,
      multiplier,
      outcome,
    });

    logger.info('Keno played', { playerId, stake: s, hits, multiplier, payout });
    return { picks, drawn, hits, multiplier, payout, balance, win: payout > 0 };
  }

  /** @override */
  async getConfig() {
    const cfg = await getKenoConfig();
    return {
      minStake: cfg.minStake,
      maxStake: cfg.maxStake,
      keno: {
        pool: cfg.pool,
        draw: cfg.draw,
        maxSpots: cfg.maxSpots,
        paytable: cfg.paytable,
      },
    };
  }
}
