import crypto from 'node:crypto';
import { withTransaction } from '../db/index.js';
import * as settingsRepo from '../db/repositories/settings.js';
import { query } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Cryptographically-seeded float in [0, 1).
const secureRng = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;

// ── Pure helpers (no DB — unit tested) ──────────────────

/** Draw `count` unique numbers from 1..poolSize (partial Fisher–Yates). */
export function drawUnique(poolSize, count, rng = secureRng) {
  const nums = Array.from({ length: poolSize }, (_, i) => i + 1);
  const n = Math.min(count, poolSize);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (poolSize - i));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums.slice(0, n).sort((a, b) => a - b);
}

/** Count how many of `picks` appear in `drawn`. */
export function countHits(picks, drawn) {
  const set = new Set(drawn);
  return picks.reduce((acc, p) => acc + (set.has(p) ? 1 : 0), 0);
}

/** Look up the Keno payout multiplier for (spots picked, hits). */
export function kenoMultiplier(paytable, spots, hits) {
  const row = paytable?.[String(spots)] || {};
  return Number(row[String(hits)] || 0);
}

/** Weighted-random segment index for the spin wheel. */
export function pickWeighted(segments, rng = secureRng) {
  const total = segments.reduce((s, seg) => s + Number(seg.weight), 0);
  let r = rng() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= Number(segments[i].weight);
    if (r < 0) return i;
  }
  return segments.length - 1;
}

// ── Config ──────────────────────────────────────────────

export async function getInstantConfig() {
  const [minStake, maxStake, kenoPool, kenoDraw, kenoMaxSpots, paytable, segments] = await Promise.all([
    settingsRepo.getNumber('instant_min_stake', 10),
    settingsRepo.getNumber('instant_max_stake', 1000),
    settingsRepo.getNumber('keno_pool', 40),
    settingsRepo.getNumber('keno_draw', 10),
    settingsRepo.getNumber('keno_max_spots', 8),
    settingsRepo.get('keno_paytable', {}),
    settingsRepo.get('spin_segments', []),
  ]);
  return {
    minStake, maxStake,
    keno: { pool: kenoPool, draw: kenoDraw, maxSpots: kenoMaxSpots, paytable },
    spin: { segments },
  };
}

function validateStake(stake, cfg) {
  const s = Number(stake);
  if (!Number.isFinite(s) || s <= 0) throw new AppError('INVALID_STAKE', 422, 'Invalid stake');
  if (s < cfg.minStake) throw new AppError('STAKE_TOO_LOW', 422, `Minimum stake is ${cfg.minStake} ETB`);
  if (s > cfg.maxStake) throw new AppError('STAKE_TOO_HIGH', 422, `Maximum stake is ${cfg.maxStake} ETB`);
  return s;
}

/** Apply a bet+payout atomically and record the ledger + audit rows. */
async function settleBet({ playerId, gameType, stake, payout, multiplier, outcome }) {
  return withTransaction(async (client) => {
    const { rows: pRows } = await client.query('SELECT wallet_balance FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    const player = pRows[0];
    if (!player) throw new AppError('PLAYER_NOT_FOUND', 404, 'Player not found');
    const bal0 = Number(player.wallet_balance);
    if (bal0 < stake) throw new AppError('INSUFFICIENT_BALANCE', 402, 'Insufficient balance');

    const bal1 = bal0 - stake;
    const bal2 = bal1 + payout;

    await client.query(
      `UPDATE players
         SET wallet_balance = $2, total_spent = total_spent + $3, total_won = total_won + $4
       WHERE id = $1`,
      [playerId, bal2, stake, payout]
    );

    const { rows: betRows } = await client.query(
      `INSERT INTO instant_bets (player_id, game_type, stake, payout, multiplier, outcome)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [playerId, gameType, stake, payout, multiplier, JSON.stringify(outcome)]
    );
    const betId = betRows[0].id;

    const betRef = `${gameType.toUpperCase()}-${betId}`;
    await client.query(
      `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
       VALUES ($1, 'bet', $2, $3, $4, $5, 'completed', $6)`,
      [playerId, stake, bal0, bal1, `${betRef}-B`, `${gameType} stake`]
    );
    if (payout > 0) {
      await client.query(
        `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
         VALUES ($1, 'payout', $2, $3, $4, $5, 'completed', $6)`,
        [playerId, payout, bal1, bal2, `${betRef}-P`, `${gameType} win ${multiplier}x`]
      );
    }

    return { betId, balance: bal2 };
  });
}

// ── Keno ────────────────────────────────────────────────

export async function playKeno({ playerId, stake, picks }, rng = secureRng) {
  const cfg = await getInstantConfig();
  const s = validateStake(stake, cfg);

  if (!Array.isArray(picks) || picks.length === 0) throw new AppError('INVALID_PICKS', 422, 'Pick at least one number');
  const unique = [...new Set(picks.map(Number))];
  if (unique.length !== picks.length) throw new AppError('INVALID_PICKS', 422, 'Duplicate numbers');
  if (unique.length > cfg.keno.maxSpots) throw new AppError('TOO_MANY_SPOTS', 422, `Pick at most ${cfg.keno.maxSpots} numbers`);
  if (unique.some((n) => !Number.isInteger(n) || n < 1 || n > cfg.keno.pool)) {
    throw new AppError('INVALID_PICKS', 422, `Numbers must be between 1 and ${cfg.keno.pool}`);
  }

  const drawn = drawUnique(cfg.keno.pool, cfg.keno.draw, rng);
  const hits = countHits(unique, drawn);
  const multiplier = kenoMultiplier(cfg.keno.paytable, unique.length, hits);
  const payout = Math.round(s * multiplier * 100) / 100;

  const outcome = { picks: unique, drawn, hits, spots: unique.length };
  const { balance } = await settleBet({ playerId, gameType: 'keno', stake: s, payout, multiplier, outcome });

  logger.info('Keno played', { playerId, stake: s, hits, multiplier, payout });
  return { picks: unique, drawn, hits, multiplier, payout, balance, win: payout > 0 };
}

// ── Spin Wheel ──────────────────────────────────────────

export async function playSpin({ playerId, stake }, rng = secureRng) {
  const cfg = await getInstantConfig();
  const s = validateStake(stake, cfg);
  const segments = cfg.spin.segments;
  if (!Array.isArray(segments) || segments.length === 0) throw new AppError('SPIN_UNAVAILABLE', 503, 'Spin is unavailable');

  const segmentIndex = pickWeighted(segments, rng);
  const multiplier = Number(segments[segmentIndex].mult);
  const payout = Math.round(s * multiplier * 100) / 100;

  const outcome = { segmentIndex, multiplier, segmentCount: segments.length };
  const { balance } = await settleBet({ playerId, gameType: 'spin', stake: s, payout, multiplier, outcome });

  logger.info('Spin played', { playerId, stake: s, segmentIndex, multiplier, payout });
  return { segmentIndex, multiplier, payout, balance, win: payout > 0 };
}

// ── History ─────────────────────────────────────────────

export async function getInstantHistory(playerId, { limit = 30, gameType } = {}) {
  let sql, params;
  if (gameType) {
    sql = `SELECT id, game_type, stake, payout, multiplier, outcome, created_at
             FROM instant_bets WHERE player_id = $1 AND game_type = $3
            ORDER BY created_at DESC LIMIT $2`;
    params = [playerId, limit, gameType];
  } else {
    sql = `SELECT id, game_type, stake, payout, multiplier, outcome, created_at
             FROM instant_bets WHERE player_id = $1
            ORDER BY created_at DESC LIMIT $2`;
    params = [playerId, limit];
  }
  const { rows } = await query(sql, params);
  return { bets: rows };
}
