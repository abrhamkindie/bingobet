/**
 * Roulette — European-style wheel with a betting "spine".
 *
 * Bet types available on the board:
 *   Even/Odd · High/Low · Red/Black
 *   Column 1 (every 3rd starting 1) · Column 2 (every 3rd starting 2)
 *   ABCDEF colour sectors · Dozens (1st / 2nd / 3rd)
 *   Tweens (11, 22, 33)
 *
 * Payouts follow standard European roulette odds; the green 0 gives the house edge.
 */

import { withTransaction } from '../db/index.js';
import * as settingsRepo from '../db/repositories/settings.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// ── Cryptographic RNG ──────────────────────────────────
import crypto from 'node:crypto';
const secureRng = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;

// ── Number definitions ──────────────────────────────────

const TOTAL_NUMBERS = 37; // 0–36

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const isRed = (n) => RED_NUMBERS.has(n);
const isBlack = (n) => n >= 1 && n <= 36 && !RED_NUMBERS.has(n);

// ── Bet definitions ───────────────────────────────────────────────────────

/**
 * Each bet type knows how to determine if the player wins and what payout ratio applies.
 *
 * @typedef {{ key:string, label:string, payout:number, check:(n:number)=>boolean }} BetType
 */

/** @type {BetType[]} */
const BET_TYPES = [
  // ── Even-money (1:1) ──
  {
    key: 'even',
    label: 'Even',
    payout: 1,
    check: (n) => n !== 0 && n % 2 === 0,
  },
  {
    key: 'odd',
    label: 'Odd',
    payout: 1,
    check: (n) => n !== 0 && n % 2 !== 0,
  },
  {
    key: 'high',
    label: '19–36',
    payout: 1,
    check: (n) => n >= 19 && n <= 36,
  },
  {
    key: 'low',
    label: '1–18',
    payout: 1,
    check: (n) => n >= 1 && n <= 18,
  },
  {
    key: 'red',
    label: 'Red',
    payout: 1,
    check: (n) => isRed(n),
  },
  {
    key: 'black',
    label: 'Black',
    payout: 1,
    check: (n) => isBlack(n),
  },

  // ── Columns (2:1) — every 3rd number ──
  {
    key: 'col1',
    label: 'Column 1',
    payout: 2,
    check: (n) => n >= 1 && n <= 36 && n % 3 === 1,
  },
  {
    key: 'col2',
    label: 'Column 2',
    payout: 2,
    check: (n) => n >= 1 && n <= 36 && n % 3 === 2,
  },
  {
    key: 'col3',
    label: 'Column 3',
    payout: 2,
    check: (n) => n >= 1 && n <= 36 && n % 3 === 0,
  },

  // ── Dozens / Derzuns (2:1) ──
  {
    key: 'dozen1',
    label: '1st 1–12',
    payout: 2,
    check: (n) => n >= 1 && n <= 12,
  },
  {
    key: 'dozen2',
    label: '2nd 13–24',
    payout: 2,
    check: (n) => n >= 13 && n <= 24,
  },
  {
    key: 'dozen3',
    label: '3rd 25–36',
    payout: 2,
    check: (n) => n >= 25 && n <= 36,
  },

  // ── ABCDEF colour collaboration sectors (5:1) ──
  {
    key: 'sectorA',
    label: 'A 1–6',
    payout: 5,
    check: (n) => n >= 1 && n <= 6,
  },
  {
    key: 'sectorB',
    label: 'B 7–12',
    payout: 5,
    check: (n) => n >= 7 && n <= 12,
  },
  {
    key: 'sectorC',
    label: 'C 13–18',
    payout: 5,
    check: (n) => n >= 13 && n <= 18,
  },
  {
    key: 'sectorD',
    label: 'D 19–24',
    payout: 5,
    check: (n) => n >= 19 && n <= 24,
  },
  {
    key: 'sectorE',
    label: 'E 25–30',
    payout: 5,
    check: (n) => n >= 25 && n <= 30,
  },
  {
    key: 'sectorF',
    label: 'F 31–36',
    payout: 5,
    check: (n) => n >= 31 && n <= 36,
  },

  // ── Tweens (11:1) — double numbers 11, 22, 33 ──
  {
    key: 'tweens',
    label: 'Tweens 11·22·33',
    payout: 11,
    check: (n) => n === 11 || n === 22 || n === 33,
  },

  // ── Straight-up number bets (35:1) — one per number 0–36 ──
  ...Array.from({ length: 37 }, (_, i) => ({
    key: `n${i}`,
    label: `${i}`,
    payout: 35,
    check: (n) => n === i,
  })),
];

/** Ordered list for the UI — groups with category info. */
const BET_GROUPS = [
  { category: 'Even Money', payout: '1:1', bets: ['even', 'odd', 'high', 'low', 'red', 'black'] },
  { category: 'Columns',     payout: '2:1', bets: ['col1', 'col2', 'col3'] },
  { category: 'Dozens',      payout: '2:1', bets: ['dozen1', 'dozen2', 'dozen3'] },
  { category: 'Sectors A–F', payout: '5:1', bets: ['sectorA', 'sectorB', 'sectorC', 'sectorD', 'sectorE', 'sectorF'] },
  { category: 'Tweens',      payout: '11:1', bets: ['tweens'] },
];

const BET_MAP = Object.fromEntries(BET_TYPES.map((b) => [b.key, b]));

/** Return the list of straight-up number bet keys (n0–n36). */
export function getStraightUpKeys() {
  return Array.from({ length: 37 }, (_, i) => `n${i}`);
}

/** Check if a bet key is a straight-up number bet. */
export function isStraightUp(key) {
  return /^n\d+$/.test(key);
}

// ── Colour codes for the UI ────────────────────────────

const SECTOR_COLORS = {
  sectorA: '#ef4444', // red
  sectorB: '#f59e0b', // amber
  sectorC: '#22c55e', // green
  sectorD: '#3b82f6', // blue
  sectorE: '#8b5cf6', // violet
  sectorF: '#ec4899', // pink
};

/**
 * Get the roulette number board layout for 0–36 in standard roulette grid order.
 * Returns an array of rows, each row is an array of { number, color }.
 * Standard European roulette board: 0 on top, then 3 rows of 12.
 */
function getBoardLayout() {
  // 3 columns × 12 rows (plus 0 on top)
  const rows = [];
  // Row 0: just the zero
  rows.push([{ number: 0, color: 'green' }]);

  // Rows 1-12: 3 numbers each
  for (let row = 0; row < 12; row++) {
    const r = [];
    for (let col = 0; col < 3; col++) {
      const n = col * 12 + row + 1; // col1=1,4,7... col2=2,5,8... col3=3,6,9...
      r.push({
        number: n,
        color: isRed(n) ? 'red' : 'black',
      });
    }
    rows.push(r);
  }
  return rows;
}

// ── Public helpers (shared with frontend) ──────────────

export function getAllBetTypes() {
  return BET_TYPES;
}

export function getBetGroups() {
  return BET_GROUPS;
}

export function getSectorColors() {
  return SECTOR_COLORS;
}

export function getNumberColor(n) {
  if (n === 0) return 'green';
  return isRed(n) ? 'red' : 'black';
}

// ── Config ─────────────────────────────────────────────

async function getRouletteConfig() {
  const [minStake, maxStake] = await Promise.all([
    settingsRepo.getNumber('instant_min_stake', 10),
    settingsRepo.getNumber('instant_max_stake', 1000),
  ]);
  return { minStake, maxStake };
}

function validateStake(stake, cfg) {
  const s = Number(stake);
  if (!Number.isFinite(s) || s <= 0) throw new AppError('INVALID_STAKE', 422, 'Invalid stake');
  if (s < cfg.minStake) throw new AppError('STAKE_TOO_LOW', 422, `Minimum stake is ${cfg.minStake} ETB`);
  if (s > cfg.maxStake) throw new AppError('STAKE_TOO_HIGH', 422, `Maximum stake is ${cfg.maxStake} ETB`);
  return s;
}

// ── Core game logic ────────────────────────────────────

export function drawNumber(rng = secureRng) {
  return Math.floor(rng() * TOTAL_NUMBERS); // 0–36
}

/** Exported for testing — resolve all selected bet types against a drawn number. */
export function resolveBets(number, selectedBets, stake) {
  /** @type {{key:string, won:boolean, payout:number}[]} */
  const results = [];
  let totalPayout = 0;

  for (const betKey of selectedBets) {
    const def = BET_MAP[betKey];
    if (!def) continue;
    const won = def.check(number);
    const payout = won ? Math.round(stake * (1 + def.payout) * 100) / 100 : 0;
    totalPayout += payout;
    results.push({ key: betKey, won, payout });
  }

  // Round total payout
  totalPayout = Math.round(totalPayout * 100) / 100;

  return { results, totalPayout };
}

// ── Play handler ───────────────────────────────────────

export async function playRoulette({ playerId, bets, stakePerBet }, rng = secureRng) {
  const cfg = await getRouletteConfig();
  const s = validateStake(stakePerBet, cfg);

  if (!Array.isArray(bets) || bets.length === 0) {
    throw new AppError('NO_BETS', 422, 'Select at least one bet type');
  }

  // Validate all bet keys
  for (const key of bets) {
    if (!BET_MAP[key]) {
      throw new AppError('INVALID_BET', 422, `Unknown bet type: ${key}`);
    }
  }

  const totalStake = Math.round(s * bets.length * 100) / 100;

  const number = drawNumber(rng);
  const { results, totalPayout } = resolveBets(number, bets, s);
  const netResult = totalPayout - totalStake;

  // Settle the bet
  const { balance } = await settleRouletteBet({
    playerId,
    stake: totalStake,
    payout: totalPayout,
    number,
    bets: results,
    stakePerBet: s,
  });

  logger.info('Roulette played', {
    playerId,
    number,
    bets: bets.length,
    totalStake,
    totalPayout,
    netResult,
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

// ── Ledger ─────────────────────────────────────────────

async function settleRouletteBet({ playerId, stake, payout, number, bets, stakePerBet }) {
  return withTransaction(async (client) => {
    const { rows: pRows } = await client.query(
      'SELECT wallet_balance FROM players WHERE id = $1 FOR UPDATE',
      [playerId]
    );
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

    const outcome = { number, bets, stakePerBet };
    const { rows: betRows } = await client.query(
      `INSERT INTO instant_bets (player_id, game_type, stake, payout, multiplier, outcome)
       VALUES ($1, 'roulette', $2, $3, $4, $5) RETURNING id`,
      [playerId, stake, payout, payout > 0 ? Math.round((payout / stake) * 100) / 100 : 0, JSON.stringify(outcome)]
    );
    const betId = betRows[0].id;

    const betRef = `ROULETTE-${betId}`;
    await client.query(
      `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
       VALUES ($1, 'bet', $2, $3, $4, $5, 'completed', $6)`,
      [playerId, stake, bal0, bal1, `${betRef}-B`, 'roulette stake']
    );

    if (payout > 0) {
      await client.query(
        `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
         VALUES ($1, 'payout', $2, $3, $4, $5, 'completed', $6)`,
        [playerId, payout, bal1, bal2, `${betRef}-P`, `roulette win`]
      );
    }

    return { betId, balance: bal2 };
  });
}
