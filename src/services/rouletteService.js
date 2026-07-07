/**
 * Roulette — European-style wheel with a betting "spine".
 *
 * Payouts follow standard European roulette odds; the green 0 gives the house edge.
 *
 * Pure helpers remain here for unit tests (rouletteService.test.js).
 * playRoulette and settlement are delegated to the GameEngine.
 *
 * @module services/rouletteService
 */

import crypto from 'node:crypto';
import { engine } from '../engine/index.js';

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

export const BET_MAP = Object.fromEntries(BET_TYPES.map((b) => [b.key, b]));

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

// ── Delegated to engine ────────────────────────────────

/** @deprecated Use engine.play('roulette', ...) via GameEngine */
export async function playRoulette({ playerId, bets, stakePerBet }) {
  return engine.play('roulette', playerId, { bets, stakePerBet });
}
