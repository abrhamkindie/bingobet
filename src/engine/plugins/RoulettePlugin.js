/**
 * RoulettePlugin — European Roulette instant game.
 *
 * Uses existing pure helpers from rouletteService:
 *   drawNumber, resolveBets, getNumberColor, getAllBetTypes, getBetGroups, getSectorColors
 *
 * Bet settlement through the unified WalletSettlement.
 */

import { GamePlugin } from '../GamePlugin.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import * as settingsRepo from '../../db/repositories/settings.js';
import {
  drawNumber,
  resolveBets,
  getNumberColor,
  getAllBetTypes,
  getBetGroups,
  getSectorColors,
  BET_MAP,
} from '../../services/rouletteService.js';

async function getRouletteConfig() {
  const [minStake, maxStake] = await Promise.all([
    settingsRepo.getNumber('instant_min_stake', 10),
    settingsRepo.getNumber('instant_max_stake', 1000),
  ]);
  return { minStake, maxStake };
}

export class RoulettePlugin extends GamePlugin {
  constructor() {
    super({
      id: 'roulette',
      label: 'Roulette',
      description: 'European roulette with full betting board',
      metadata: {
        type: 'instant',
        minStake: 10,
        maxStake: 1000,
      },
    });
  }

  /** @override */
  validate(playerId, input) {
    const { bets, stakePerBet } = input;

    if (!Array.isArray(bets) || bets.length === 0) {
      throw new AppError('NO_BETS', 422, 'Select at least one bet type');
    }

    // Validate all bet keys
    for (const key of bets) {
      if (!BET_MAP[key]) {
        throw new AppError('INVALID_BET', 422, `Unknown bet type: ${key}`);
      }
    }

    const s = Number(stakePerBet);
    if (!Number.isFinite(s) || s <= 0) {
      throw new AppError('INVALID_STAKE', 422, 'Invalid stake');
    }

    return { bets, stakePerBet: s };
  }

  /** @override */
  async play(playerId, input) {
    const cfg = await getRouletteConfig();
    const { bets, stakePerBet: s } = this.validate(playerId, input);

    if (s < cfg.minStake) {
      throw new AppError('STAKE_TOO_LOW', 422, `Minimum stake is ${cfg.minStake} ETB`);
    }
    if (s > cfg.maxStake) {
      throw new AppError('STAKE_TOO_HIGH', 422, `Maximum stake is ${cfg.maxStake} ETB`);
    }

    const totalStake = Math.round(s * bets.length * 100) / 100;
    const number = drawNumber(this.rng.next);
    const { results, totalPayout } = resolveBets(number, bets, s);
    const netResult = totalPayout - totalStake;
    const multiplier = totalPayout > 0 ? Math.round((totalPayout / totalStake) * 100) / 100 : 0;

    const outcome = { number, bets: results, stakePerBet: s };
    const { balance } = await this.settle({
      playerId,
      stake: totalStake,
      payout: totalPayout,
      multiplier,
      outcome,
      notes: 'roulette stake',
    });

    logger.info('Roulette played', {
      playerId, number, bets: bets.length, totalStake, totalPayout, netResult,
    });

    return {
      number,
      numberColor: getNumberColor(number),
      results,
      totalStake,
      totalPayout,
      netResult,
      balance,
      win: totalPayout > 0,
      stakePerBet: s,
    };
  }

  /** @override */
  async getConfig() {
    const cfg = await getRouletteConfig();
    return {
      minStake: cfg.minStake,
      maxStake: cfg.maxStake,
      roulette: {
        types: getAllBetTypes(),
        groups: getBetGroups(),
        sectorColors: getSectorColors(),
      },
    };
  }
}
