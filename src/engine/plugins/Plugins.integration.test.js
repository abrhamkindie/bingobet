/**
 * Integration tests for game plugins (Keno, Spin, Roulette).
 *
 * Mocks:
 *   - settingsRepo — returns test config values (no DB needed)
 *   - settleBet     — returns deterministic results (no DB needed)
 *   - logger        — silences log output during tests
 *
 * All tests use a deterministic RNG so outcomes are predictable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock settings repo — must be before any plugin imports ──
const mockSettings = new Map();

vi.mock('../../db/repositories/settings.js', () => ({
  get: vi.fn(async (key, fallback) => {
    return mockSettings.has(key) ? mockSettings.get(key) : fallback;
  }),
  getNumber: vi.fn(async (key, fallback) => {
    const v = mockSettings.has(key) ? mockSettings.get(key) : fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }),
  set: vi.fn(async (key, value) => {
    mockSettings.set(key, value);
    return { key, value };
  }),
}));

// ── Mock settleBet — returns deterministic result ──
vi.mock('../WalletSettlement.js', () => ({
  settleBet: vi.fn(async ({ playerId, stake, payout }) => ({
    betId: 999,
    balance: 1000 + payout - stake, // start at 1000, deduct stake, add payout
  })),
}));

// ── Logger mock ──
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── DB & repo mocks for LotteryPlugin ──
// vi.hoisted ensures these are created before the hoisted vi.mock factories run.
const { mockLotteryDb, mockGameRoundsRepo, mockTicketsRepo, mockPlayersRepo, mockDrawnNumbersRepo } = vi.hoisted(() => {
  const client = { query: vi.fn() };
  return {
    mockLotteryDb: {
      client,
      db: {
        query: vi.fn(),
        withTransaction: vi.fn(async (fn) => fn(client)),
      },
    },
    mockGameRoundsRepo: {
      create: vi.fn(),
      getById: vi.fn(),
      listActive: vi.fn(),
      listAll: vi.fn(),
      updateStatus: vi.fn(),
      getScheduledDrawsDue: vi.fn(),
      getCompletedWithStats: vi.fn(),
    },
    mockTicketsRepo: {
      listByPlayer: vi.fn(),
      listByGameAndPlayer: vi.fn(),
      getById: vi.fn(),
      listByGame: vi.fn(),
    },
    mockPlayersRepo: {
      getById: vi.fn(),
    },
    mockDrawnNumbersRepo: {
      listByGame: vi.fn(),
    },
  };
});

vi.mock('../../db/index.js', () => mockLotteryDb.db);
vi.mock('../../db/repositories/gameRounds.js', () => mockGameRoundsRepo);
vi.mock('../../db/repositories/tickets.js', () => mockTicketsRepo);
vi.mock('../../db/repositories/players.js', () => mockPlayersRepo);
vi.mock('../../db/repositories/drawnNumbers.js', () => mockDrawnNumbersRepo);

vi.mock('../../utils/code.js', () => ({
  generateConfirmationCode: vi.fn(() => 'BB-TEST123'),
}));

// ── Imports after mocks are set up ──
import { KenoPlugin } from './KenoPlugin.js';
import { SpinPlugin } from './SpinPlugin.js';
import { RoulettePlugin } from './RoulettePlugin.js';
import { LotteryPlugin } from './LotteryPlugin.js';
import { GameEngine } from '../GameEngine.js';
import { createRngProvider } from '../RngProvider.js';
import { AppError } from '../../utils/errors.js';

// ── Default test config ──
const DEFAULT_KENO_PAYTABLE = {
  '1': { '1': 3.2 },
  '2': { '1': 1, '2': 8 },
  '3': { '2': 2, '3': 16 },
  '4': { '2': 1, '3': 4, '4': 40 },
  '5': { '3': 2, '4': 8, '5': 80 },
  '6': { '3': 1, '4': 4, '5': 15, '6': 120 },
  '7': { '4': 2, '5': 8, '6': 30, '7': 300 },
  '8': { '4': 1, '5': 4, '6': 15, '7': 60, '8': 600 },
};

const DEFAULT_SPIN_SEGMENTS = [
  { mult: 0,  weight: 495, color: '#334155' },
  { mult: 1,  weight: 225, color: '#0d9488' },
  { mult: 1.5,weight: 140, color: '#14b8a6' },
  { mult: 2,  weight: 80,  color: '#2dd4bf' },
  { mult: 3,  weight: 35,  color: '#22d3ee' },
  { mult: 5,  weight: 18,  color: '#f59e0b' },
  { mult: 10, weight: 6,   color: '#fbbf24' },
  { mult: 50, weight: 1,   color: '#f43f5e' },
];

function setupDefaultConfig() {
  mockSettings.set('instant_min_stake', 10);
  mockSettings.set('instant_max_stake', 1000);
  mockSettings.set('keno_pool', 40);
  mockSettings.set('keno_draw', 10);
  mockSettings.set('keno_max_spots', 8);
  mockSettings.set('keno_paytable', DEFAULT_KENO_PAYTABLE);
  mockSettings.set('spin_segments', DEFAULT_SPIN_SEGMENTS);
}

function createEngine(seed = 42) {
  const engine = new GameEngine({ rng: createRngProvider(seed) });
  return engine;
}

async function registerAndInit(engine, plugins) {
  for (const p of plugins) engine.register(p);
  await engine.init();
}

// ─────────────────────────────────────────────────────────
// KenoPlugin
// ─────────────────────────────────────────────────────────

describe('KenoPlugin', () => {
  let engine;
  let plugin;

  beforeEach(async () => {
    setupDefaultConfig();
    engine = createEngine(42);
    plugin = new KenoPlugin();
    await registerAndInit(engine, [plugin]);
  });

  // ── validate ──

  describe('validate', () => {
    it('accepts valid input', () => {
      const result = plugin.validate(1, { stake: 50, picks: [1, 5, 10, 15, 20] });
      expect(result).toEqual({ stake: 50, picks: [1, 5, 10, 15, 20] });
    });

    it('throws for duplicate picks', () => {
      expect(() => plugin.validate(1, { stake: 50, picks: [1, 5, 5, 10] }))
        .toThrow('Duplicate numbers');
    });

    it('throws for empty picks', () => {
      expect(() => plugin.validate(1, { stake: 50, picks: [] }))
        .toThrow('Pick at least one number');
    });

    it('throws for missing picks array', () => {
      expect(() => plugin.validate(1, { stake: 50 }))
        .toThrow('Pick at least one number');
    });

    it('throws for non-array picks', () => {
      expect(() => plugin.validate(1, { stake: 50, picks: 'abc' }))
        .toThrow('Pick at least one number');
    });

    it('throws for duplicate picks', () => {
      expect(() => plugin.validate(1, { stake: 50, picks: [1, 2, 2, 3] }))
        .toThrow('Duplicate numbers');
    });

    it('throws for invalid stake (zero)', () => {
      expect(() => plugin.validate(1, { stake: 0, picks: [1, 2] }))
        .toThrow('Invalid stake');
    });

    it('throws for invalid stake (negative)', () => {
      expect(() => plugin.validate(1, { stake: -10, picks: [1, 2] }))
        .toThrow('Invalid stake');
    });

    it('throws for invalid stake (NaN)', () => {
      expect(() => plugin.validate(1, { stake: 'abc', picks: [1, 2] }))
        .toThrow('Invalid stake');
    });
  });

  // ── play ──

  describe('play', () => {
    it('returns a valid result structure for a winning play', async () => {
      // Use a fixed RNG that gives known outcomes
      // Seed 900 → predictable drawUnique result
      const engine2 = createEngine(900);
      const p2 = new KenoPlugin();
      await registerAndInit(engine2, [p2]);

      const result = await p2.play(1, { stake: 50, picks: [1, 5, 10, 12] });

      expect(result).toHaveProperty('picks', [1, 5, 10, 12]);
      expect(result).toHaveProperty('drawn');
      expect(Array.isArray(result.drawn)).toBe(true);
      expect(result.drawn.length).toBe(10);
      expect(result).toHaveProperty('hits');
      expect(typeof result.hits).toBe('number');
      expect(result).toHaveProperty('multiplier');
      expect(typeof result.multiplier).toBe('number');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('win');
      expect(typeof result.win).toBe('boolean');
      // If hits > 0, win should be true and payout > 0
      if (result.hits > 0) {
        expect(result.win).toBe(true);
        expect(result.payout).toBeGreaterThan(0);
        expect(result.multiplier).toBeGreaterThan(0);
      } else {
        expect(result.win).toBe(false);
        expect(result.payout).toBe(0);
      }
    });

    it('returns a loss when picks match nothing', async () => {
      // Custom RNG that always returns 0 → drawUnique keeps numbers 1..10
      // Picks [30..35] will never match, so hits = 0
      const customRng = { next: () => 0 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new KenoPlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { stake: 50, picks: [30, 31, 32, 33, 34, 35] });
      expect(result.hits).toBe(0);
      expect(result.win).toBe(false);
      expect(result.payout).toBe(0);
    });

    it('throws for too many spots', async () => {
      await expect(plugin.play(1, { stake: 50, picks: [1, 2, 3, 4, 5, 6, 7, 8, 9] }))
        .rejects.toThrow('Pick at most 8 numbers');
    });

    it('throws for picks out of range', async () => {
      await expect(plugin.play(1, { stake: 50, picks: [0, 1, 2] }))
        .rejects.toThrow('Numbers must be between 1 and 40');
      await expect(plugin.play(1, { stake: 50, picks: [1, 41] }))
        .rejects.toThrow('Numbers must be between 1 and 40');
    });

    it('throws for stake below minimum', async () => {
      await expect(plugin.play(1, { stake: 5, picks: [1, 2] }))
        .rejects.toThrow('Minimum stake is 10 ETB');
    });

    it('throws for stake above maximum', async () => {
      await expect(plugin.play(1, { stake: 2000, picks: [1, 2] }))
        .rejects.toThrow('Maximum stake is 1000 ETB');
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('returns the full config structure', async () => {
      const cfg = await plugin.getConfig();
      expect(cfg).toHaveProperty('minStake', 10);
      expect(cfg).toHaveProperty('maxStake', 1000);
      expect(cfg).toHaveProperty('keno');
      expect(cfg.keno).toHaveProperty('pool', 40);
      expect(cfg.keno).toHaveProperty('draw', 10);
      expect(cfg.keno).toHaveProperty('maxSpots', 8);
      expect(cfg.keno).toHaveProperty('paytable');
      expect(cfg.keno.paytable).toEqual(DEFAULT_KENO_PAYTABLE);
    });
  });
});

// ─────────────────────────────────────────────────────────
// SpinPlugin
// ─────────────────────────────────────────────────────────

describe('SpinPlugin', () => {
  let engine;
  let plugin;

  beforeEach(async () => {
    setupDefaultConfig();
    engine = createEngine(42);
    plugin = new SpinPlugin();
    await registerAndInit(engine, [plugin]);
  });

  // ── validate ──

  describe('validate', () => {
    it('accepts valid stake', () => {
      const result = plugin.validate(1, { stake: 100 });
      expect(result).toEqual({ stake: 100 });
    });

    it('throws for invalid stake (zero)', () => {
      expect(() => plugin.validate(1, { stake: 0 })).toThrow('Invalid stake');
    });

    it('throws for invalid stake (negative)', () => {
      expect(() => plugin.validate(1, { stake: -5 })).toThrow('Invalid stake');
    });

    it('throws for missing stake', () => {
      expect(() => plugin.validate(1, {})).toThrow('Invalid stake');
    });
  });

  // ── play ──

  describe('play', () => {
    it('returns a valid result structure for a win', async () => {
      // Seed 42 with the default segments: pickWeighted with `next()` first value
      // segments[0] has weight 495/1000 → rng=0.041 → segment 0 (0×) which is a loss
      // Let's use a seed that lands on a winning segment
      // Segment 3 has weight 80, cumulative through 495+225+140+80 = 940/1000 → rng ∈ [0.86, 0.94)
      // rng = 0.9 → segment 3 → 2×
      const engine2 = createEngine(999);
      const p2 = new SpinPlugin();
      await registerAndInit(engine2, [p2]);

      const result = await p2.play(1, { stake: 100 });

      expect(result).toHaveProperty('segmentIndex');
      expect(typeof result.segmentIndex).toBe('number');
      expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result.segmentIndex).toBeLessThan(8);
      expect(result).toHaveProperty('multiplier');
      expect(typeof result.multiplier).toBe('number');
      expect(result).toHaveProperty('payout');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('win');
      expect(typeof result.win).toBe('boolean');

      const expectedPayout = Math.round(100 * result.multiplier * 100) / 100;
      expect(result.payout).toBe(expectedPayout);
      expect(result.win).toBe(result.payout > 0);
    });

    it('returns loss for 0× segment (custom RNG)', async () => {
      // rng returning 0 → lands in segment 0 (weight 495/1000, mult 0×)
      const customRng = { next: () => 0 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new SpinPlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { stake: 50 });
      expect(result.segmentIndex).toBe(0);
      expect(result.multiplier).toBe(0);
      expect(result.payout).toBe(0);
      expect(result.win).toBe(false);
    });

    it('hits a known 2× segment using a custom RNG', async () => {
      // Segment 3 has cumulative range [0.860, 0.940): weight 80/1000
      // rng = 0.9 → falls in segment 3 → mult = 2, stake 100 → payout = 200
      const customRng = { next: () => 0.9 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new SpinPlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { stake: 100 });

      expect(result.segmentIndex).toBe(3);
      expect(result.multiplier).toBe(2);
      expect(result.payout).toBe(200);
      expect(result.balance).toBe(1100); // 1000 - 100 + 200
      expect(result.win).toBe(true);
    });

    it('hits the 50× jackpot segment using a custom RNG', async () => {
      // Segment 7 has cumulative range [0.999, 1.0): weight 1/1000
      // rng = 0.9995 → falls in segment 7 → mult = 50, stake 10 → payout = 500
      const customRng = { next: () => 0.9995 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new SpinPlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { stake: 10 });

      expect(result.segmentIndex).toBe(7);
      expect(result.multiplier).toBe(50);
      expect(result.payout).toBe(500);
      expect(result.balance).toBe(1490); // 1000 - 10 + 500
      expect(result.win).toBe(true);
    });

    it('throws for stake below minimum', async () => {
      await expect(plugin.play(1, { stake: 3 }))
        .rejects.toThrow('Minimum stake is 10 ETB');
    });

    it('throws for stake above maximum', async () => {
      await expect(plugin.play(1, { stake: 5000 }))
        .rejects.toThrow('Maximum stake is 1000 ETB');
    });

    it('throws SPIN_UNAVAILABLE when spin_segments is empty in settings', async () => {
      // Override segments to empty — the plugin checks cfg.segments.length === 0
      mockSettings.set('spin_segments', []);

      await expect(plugin.play(1, { stake: 50 }))
        .rejects.toThrow('Spin is unavailable');

      // Restore so other tests are not affected
      mockSettings.set('spin_segments', DEFAULT_SPIN_SEGMENTS);
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('returns the full config with spin segments', async () => {
      const cfg = await plugin.getConfig();
      expect(cfg).toHaveProperty('minStake', 10);
      expect(cfg).toHaveProperty('maxStake', 1000);
      expect(cfg).toHaveProperty('spin');
      expect(cfg.spin).toHaveProperty('segments');
      expect(cfg.spin.segments).toEqual(DEFAULT_SPIN_SEGMENTS);
    });
  });
});

// ─────────────────────────────────────────────────────────
// RoulettePlugin
// ─────────────────────────────────────────────────────────

describe('RoulettePlugin', () => {
  let engine;
  let plugin;

  beforeEach(async () => {
    setupDefaultConfig();
    engine = createEngine(42);
    plugin = new RoulettePlugin();
    await registerAndInit(engine, [plugin]);
  });

  // ── validate ──

  describe('validate', () => {
    it('accepts valid bets with even money', () => {
      const result = plugin.validate(1, { bets: ['even', 'red'], stakePerBet: 50 });
      expect(result).toEqual({ bets: ['even', 'red'], stakePerBet: 50 });
    });

    it('accepts straight-up number bets', () => {
      const result = plugin.validate(1, { bets: ['n0', 'n17', 'n36'], stakePerBet: 10 });
      expect(result).toEqual({ bets: ['n0', 'n17', 'n36'], stakePerBet: 10 });
    });

    it('throws for empty bets array', () => {
      expect(() => plugin.validate(1, { bets: [], stakePerBet: 50 }))
        .toThrow('Select at least one bet type');
    });

    it('throws for missing bets', () => {
      expect(() => plugin.validate(1, { stakePerBet: 50 }))
        .toThrow('Select at least one bet type');
    });

    it('throws for unknown bet key', () => {
      expect(() => plugin.validate(1, { bets: ['even', 'fake_bet'], stakePerBet: 50 }))
        .toThrow('Unknown bet type: fake_bet');
    });

    it('throws for invalid stake', () => {
      expect(() => plugin.validate(1, { bets: ['even'], stakePerBet: 0 }))
        .toThrow('Invalid stake');
    });
  });

  // ── play ──

  describe('play', () => {
    it('returns a valid result structure for a winning play', async () => {
      // Custom RNG returning 1/37 → floor((1/37) * 37) = floor(1) = 1
      // Number 1 is odd, red, low, col1 (1%3=1), dozen1 (1–12), sectorA (1–6)
      // Bet on 'odd' → win (1:1 → payout = 20 on stake 10)
      const customRng = { next: () => 1 / 37 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new RoulettePlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { bets: ['odd'], stakePerBet: 10 });

      expect(result).toHaveProperty('number', 1);
      expect(result).toHaveProperty('numberColor', 'red');
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results[0]).toMatchObject({ key: 'odd', won: true });

      expect(result).toHaveProperty('totalStake', 10);
      expect(result).toHaveProperty('totalPayout', 20);
      expect(result).toHaveProperty('netResult', 10);
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('win', true);
      expect(result).toHaveProperty('stakePerBet', 10);
    });

    it('returns correct results for multiple simultaneous bets', async () => {
      // Use a custom RNG that returns exactly 1/37 ≈ 0.027 → drawNumber(0.027) = 1
      // Number 1 is odd, red, low, col1, dozen1, sectorA
      const customRng = { next: () => 1 / 37 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new RoulettePlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { bets: ['even', 'odd', 'red', 'black'], stakePerBet: 10 });

      expect(result.number).toBe(1);
      expect(result.numberColor).toBe('red');
      expect(result.totalStake).toBe(40); // 4 bets × 10
      expect(result.totalPayout).toBe(40); // odd:20 + red:20
      expect(result.netResult).toBe(0);

      const winMap = {};
      for (const r of result.results) winMap[r.key] = r.won;
      expect(winMap.even).toBe(false);
      expect(winMap.odd).toBe(true);
      expect(winMap.red).toBe(true);
      expect(winMap.black).toBe(false);
    });

    it('returns loss on number 0 for all even-money bets', async () => {
      // rng returning exactly 0 → floor(0) = 0
      const customRng = { next: () => 0 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new RoulettePlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { bets: ['even', 'odd', 'red', 'black', 'high', 'low'], stakePerBet: 10 });

      expect(result.number).toBe(0);
      expect(result.numberColor).toBe('green');
      expect(result.totalPayout).toBe(0);
      expect(result.win).toBe(false);
      for (const r of result.results) {
        expect(r.won).toBe(false);
      }
    });

    it('n0 wins on number 0', async () => {
      const customRng = { next: () => 0 };
      const e2 = new GameEngine({ rng: customRng });
      const p2 = new RoulettePlugin();
      await registerAndInit(e2, [p2]);

      const result = await p2.play(1, { bets: ['n0'], stakePerBet: 10 });

      expect(result.number).toBe(0);
      expect(result.totalPayout).toBe(360); // 10 × 36
      expect(result.results[0].won).toBe(true);
      expect(result.win).toBe(true);
    });

    it('all 37 straight-up number bets win with correct 35:1 payout via custom RNG', async () => {
      for (let i = 0; i <= 36; i++) {
        // Midpoint of bin [i/37, (i+1)/37) so floating-point rounding can't
        // push us into the wrong bin (e.g. 36/37 * 37 could round to 35.999)
        const customRng = { next: () => (i + 0.5) / 37 };
        const e2 = new GameEngine({ rng: customRng });
        const p2 = new RoulettePlugin();
        await registerAndInit(e2, [p2]);

        const result = await p2.play(1, { bets: [`n${i}`], stakePerBet: 10 });

        expect(result.number).toBe(i);
        expect(result.numberColor).toBe(i === 0 ? 'green' : i <= 36 && [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(i) ? 'red' : 'black');
        expect(result.results[0]).toMatchObject({ key: `n${i}`, won: true });
        expect(result.results[0].payout).toBe(360); // 10 × 36
        expect(result.totalStake).toBe(10);
        expect(result.totalPayout).toBe(360);
        expect(result.win).toBe(true);
      }
    });

    it('tweens bet wins on number 11 and loses on 12', async () => {
      // rng such that drawNumber returns floor(rng * 37)
      // For number 11: rng ∈ [11/37, 12/37) = [0.2973, 0.3243)
      const winningRng = { next: () => 11.5 / 37 }; // → floor(11.5) = 11
      const e2 = new GameEngine({ rng: winningRng });
      const p2 = new RoulettePlugin();
      await registerAndInit(e2, [p2]);

      const win = await p2.play(1, { bets: ['tweens'], stakePerBet: 10 });
      expect(win.number).toBe(11);
      expect(win.results[0].won).toBe(true);
      expect(win.results[0].payout).toBe(120); // 10 × 12
      expect(win.win).toBe(true);

      // For number 12: rng ∈ [12/37, 13/37) = [0.3243, 0.3514)
      const losingRng = { next: () => 12.5 / 37 }; // → floor(12.5) = 12
      const e3 = new GameEngine({ rng: losingRng });
      const p3 = new RoulettePlugin();
      await registerAndInit(e3, [p3]);

      const lose = await p3.play(1, { bets: ['tweens'], stakePerBet: 10 });
      expect(lose.number).toBe(12);
      expect(lose.results[0].won).toBe(false);
      expect(lose.win).toBe(false);
    });

    it('throws for stake below minimum', async () => {
      await expect(plugin.play(1, { bets: ['even'], stakePerBet: 2 }))
        .rejects.toThrow('Minimum stake is 10 ETB');
    });

    it('throws for stake above maximum', async () => {
      await expect(plugin.play(1, { bets: ['even'], stakePerBet: 5000 }))
        .rejects.toThrow('Maximum stake is 1000 ETB');
    });

    it('throws for unknown bet type', async () => {
      await expect(plugin.play(1, { bets: ['nonexistent'], stakePerBet: 10 }))
        .rejects.toThrow('Unknown bet type: nonexistent');
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('returns the full config with roulette metadata', async () => {
      const cfg = await plugin.getConfig();
      expect(cfg).toHaveProperty('minStake', 10);
      expect(cfg).toHaveProperty('maxStake', 1000);
      expect(cfg).toHaveProperty('roulette');
      expect(cfg.roulette).toHaveProperty('types');
      expect(cfg.roulette).toHaveProperty('groups');
      expect(cfg.roulette).toHaveProperty('sectorColors');

      // Verify bet types are present
      expect(Array.isArray(cfg.roulette.types)).toBe(true);
      expect(cfg.roulette.types.length).toBe(56); // 19 grouped + 37 straight-up
      expect(cfg.roulette.types[0]).toHaveProperty('key');
      expect(cfg.roulette.types[0]).toHaveProperty('payout');
      expect(typeof cfg.roulette.types[0].check).toBe('function');

      // Verify groups
      expect(Array.isArray(cfg.roulette.groups)).toBe(true);
      expect(cfg.roulette.groups.length).toBe(5);
      expect(cfg.roulette.groups[0].bets).toContain('even');

      // Verify sector colors
      expect(cfg.roulette.sectorColors).toHaveProperty('sectorA');
      expect(cfg.roulette.sectorColors.sectorA).toBe('#ef4444');
    });
  });
});

// ─────────────────────────────────────────────────────────
// LotteryPlugin
// ─────────────────────────────────────────────────────────

describe('LotteryPlugin', () => {
  let engine;
  let plugin;

  const MOCK_GAME = {
    id: 1,
    title: 'Test Draw',
    description: 'A test game',
    status: 'active',
    ticket_price: 50,
    max_tickets: 1000,
    max_tickets_per_player: 10,
    tickets_sold: 0,
    number_min: 1,
    number_max: 50,
    numbers_per_ticket: 6,
    numbers_to_draw: 6,
    prize_pool: 50000,
    platform_fee: 5000,
    prize_tiers: null,
    draw_type: 'scheduled',
    scheduled_draw_at: '2026-07-10T12:00:00Z',
    created_at: new Date('2026-07-06'),
    created_by: 1,
  };

  const MOCK_PLAYER = {
    id: 42,
    telegram_id: 123456789,
    name: 'Test Player',
    wallet_balance: 500,
    total_spent: 0,
    total_won: 0,
  };

  const MOCK_TICKET = {
    id: 99,
    player_id: 42,
    game_round_id: 1,
    position: 1,
    numbers: [3, 17, 22, 31, 42, 48],
    status: 'active',
    created_at: new Date(),
  };

  function setupActiveGame(overrides = {}) {
    const game = { ...MOCK_GAME, ...overrides };
    mockGameRoundsRepo.getById.mockResolvedValue(game);
    return game;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    mockLotteryDb.client.query.mockReset();
    mockLotteryDb.db.query.mockReset();
    mockLotteryDb.db.withTransaction.mockReset();
    mockLotteryDb.db.withTransaction.mockImplementation(async (fn) => fn(mockLotteryDb.client));

    engine = new GameEngine({ rng: createRngProvider(42) });
    plugin = new LotteryPlugin();
    await engine.register(plugin);
    await engine.init();
  });

  // ── constructor / init ──

  describe('constructor / init', () => {
    it('sets correct metadata', () => {
      expect(plugin.id).toBe('lottery');
      expect(plugin.label).toBe('Lottery');
      expect(plugin.description).toContain('Buy tickets');
      expect(plugin.metadata).toEqual({ type: 'round' });
    });

    it('creates a lifecycle FSM on init', () => {
      expect(plugin.fsm).toBeTruthy();
      expect(plugin.fsm.id).toBe('lottery');
      expect(plugin.fsm.initial).toBe('upcoming');
      expect(plugin.fsm.state).toBe('upcoming');
    });

    it('is registered and listed by the engine', () => {
      expect(engine.get('lottery')).toBe(plugin);
      expect(engine.list()).toContain('lottery');
    });
  });

  // ── createRound ──

  describe('createRound', () => {
    it('delegates to gameRoundsRepo.create and returns the result', async () => {
      mockGameRoundsRepo.create.mockResolvedValue(MOCK_GAME);

      const data = { title: 'New Game', ticketPrice: 30 };
      const result = await plugin.createRound(data);

      expect(mockGameRoundsRepo.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(MOCK_GAME);
    });
  });

  // ── listActiveGames / listAllGames ──

  describe('listActiveGames', () => {
    it('delegates to gameRoundsRepo.listActive', async () => {
      mockGameRoundsRepo.listActive.mockResolvedValue([MOCK_GAME]);

      const result = await plugin.listActiveGames();
      expect(mockGameRoundsRepo.listActive).toHaveBeenCalledOnce();
      expect(result).toEqual([MOCK_GAME]);
    });
  });

  describe('listAllGames', () => {
    it('delegates to gameRoundsRepo.listAll with options', async () => {
      mockGameRoundsRepo.listAll.mockResolvedValue({ games: [MOCK_GAME], total: 1 });

      const result = await plugin.listAllGames({ status: 'completed', limit: 10 });
      expect(mockGameRoundsRepo.listAll).toHaveBeenCalledWith({ status: 'completed', limit: 10 });
      expect(result.games).toEqual([MOCK_GAME]);
    });
  });

  // ── getGame ──

  describe('getGame', () => {
    it('returns the game when found', async () => {
      mockGameRoundsRepo.getById.mockResolvedValue(MOCK_GAME);

      const result = await plugin.getGame(1);
      expect(mockGameRoundsRepo.getById).toHaveBeenCalledWith(1);
      expect(result).toEqual(MOCK_GAME);
    });

    it('throws GAME_NOT_FOUND when missing', async () => {
      mockGameRoundsRepo.getById.mockResolvedValue(null);

      await expect(plugin.getGame(999)).rejects.toMatchObject({
        code: 'GAME_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ── startDraw ──

  describe('startDraw', () => {
    it('executes the draw when game is active', async () => {
      const activeGame = { ...MOCK_GAME, status: 'active' };
      mockGameRoundsRepo.getById.mockResolvedValue(activeGame);
      mockGameRoundsRepo.updateStatus.mockResolvedValue({ ...activeGame, status: 'drawing' });
      mockLotteryDb.db.query.mockResolvedValue({ rows: [{ result: { winnerCount: 3 } }] });

      const result = await plugin.startDraw(1);

      expect(mockGameRoundsRepo.getById).toHaveBeenCalledWith(1);
      expect(mockGameRoundsRepo.updateStatus).toHaveBeenCalledWith(1, 'drawing');
      expect(mockLotteryDb.db.query).toHaveBeenCalledWith(
        'SELECT complete_game_draw($1) AS result',
        [1]
      );
      expect(result).toEqual({ winnerCount: 3 });
    });

    it('throws GAME_NOT_FOUND when game is missing', async () => {
      mockGameRoundsRepo.getById.mockResolvedValue(null);

      await expect(plugin.startDraw(999)).rejects.toMatchObject({
        code: 'GAME_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws GAME_NOT_DRAWABLE when game is not active', async () => {
      const upcomingGame = { ...MOCK_GAME, status: 'upcoming' };
      mockGameRoundsRepo.getById.mockResolvedValue(upcomingGame);

      await expect(plugin.startDraw(1)).rejects.toMatchObject({
        code: 'GAME_NOT_DRAWABLE',
        statusCode: 409,
      });
    });

    it('throws GAME_NOT_DRAWABLE when game is already completed', async () => {
      const completedGame = { ...MOCK_GAME, status: 'completed' };
      mockGameRoundsRepo.getById.mockResolvedValue(completedGame);

      await expect(plugin.startDraw(1)).rejects.toMatchObject({
        code: 'GAME_NOT_DRAWABLE',
        statusCode: 409,
      });
    });
  });

  // ── play (delegates to buyTicket) ──

  describe('play', () => {
    it('throws INVALID_INPUT when gameRoundId is missing', async () => {
      await expect(plugin.play(42, {})).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        statusCode: 422,
      });
    });

    it('delegates to buyTicket with playerId and gameRoundId', async () => {
      const buySpy = vi.spyOn(plugin, 'buyTicket').mockResolvedValue({ ticket: MOCK_TICKET });

      const result = await plugin.play(42, { gameRoundId: 1 });

      expect(buySpy).toHaveBeenCalledWith({ playerId: 42, gameRoundId: 1 });
      expect(result).toEqual({ ticket: MOCK_TICKET });
    });
  });

  // ── buyTicket ──

  describe('buyTicket', () => {
    it('throws GAME_NOT_FOUND when game is missing', async () => {
      mockGameRoundsRepo.getById.mockResolvedValue(null);

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 999 }))
        .rejects.toMatchObject({ code: 'GAME_NOT_FOUND', statusCode: 404 });
    });

    it('throws GAME_NOT_ACCEPTING_TICKETS when game is completed', async () => {
      setupActiveGame({ status: 'completed' });

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'GAME_NOT_ACCEPTING_TICKETS', statusCode: 409 });
    });

    it('throws GAME_NOT_ACCEPTING_TICKETS when game is cancelled', async () => {
      setupActiveGame({ status: 'cancelled' });

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'GAME_NOT_ACCEPTING_TICKETS', statusCode: 409 });
    });

    it('accepts tickets for upcoming games', async () => {
      setupActiveGame({ status: 'upcoming', tickets_sold: 0 });
      mockPlayersRepo.getById.mockResolvedValue(MOCK_PLAYER);
      mockTicketsRepo.listByGameAndPlayer.mockResolvedValue([]);

      mockLotteryDb.client.query
        .mockResolvedValueOnce({ rows: [{ id: 99 }] })               // buy_ticket
        .mockResolvedValueOnce({ rows: [MOCK_TICKET] })              // SELECT tickets
        .mockResolvedValueOnce({ rows: [MOCK_PLAYER] })              // SELECT player
        .mockResolvedValueOnce({});                                    // INSERT transaction

      const result = await plugin.buyTicket({ playerId: 42, gameRoundId: 1 });
      expect(result.ticket.id).toBe(99);
    });

    it('throws GAME_SOLD_OUT when max tickets reached', async () => {
      setupActiveGame({ tickets_sold: 1000, max_tickets: 1000 });

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'GAME_SOLD_OUT', statusCode: 409 });
    });

    it('throws PLAYER_NOT_FOUND when player is missing', async () => {
      setupActiveGame({ tickets_sold: 0 });
      mockPlayersRepo.getById.mockResolvedValue(null);

      await expect(plugin.buyTicket({ playerId: 999, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND', statusCode: 404 });
    });

    it('throws INSUFFICIENT_BALANCE when player has insufficient funds', async () => {
      setupActiveGame({ tickets_sold: 0, ticket_price: 500 });
      mockPlayersRepo.getById.mockResolvedValue({ ...MOCK_PLAYER, wallet_balance: 100 });

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE', statusCode: 402 });
    });

    it('throws PLAYER_TICKET_LIMIT_REACHED when player has max tickets', async () => {
      setupActiveGame({ tickets_sold: 0 });
      mockPlayersRepo.getById.mockResolvedValue(MOCK_PLAYER);
      mockTicketsRepo.listByGameAndPlayer.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: i }))
      );

      await expect(plugin.buyTicket({ playerId: 42, gameRoundId: 1 }))
        .rejects.toMatchObject({ code: 'PLAYER_TICKET_LIMIT_REACHED', statusCode: 409 });
    });

    it('buys a ticket successfully and records the transaction', async () => {
      setupActiveGame({
        tickets_sold: 5,
        max_tickets: 1000,
        ticket_price: 50,
        title: 'Test Draw',
        scheduled_draw_at: '2026-07-10T12:00:00Z',
        numbers_to_draw: 6,
      });
      mockPlayersRepo.getById.mockResolvedValue(MOCK_PLAYER);
      mockTicketsRepo.listByGameAndPlayer.mockResolvedValue([]);

      // Simulate client.query calls inside withTransaction
      mockLotteryDb.client.query
        .mockResolvedValueOnce({ rows: [{ id: 99 }] })                // buy_ticket
        .mockResolvedValueOnce({ rows: [MOCK_TICKET] })               // SELECT ticket
        .mockResolvedValueOnce({ rows: [{ ...MOCK_PLAYER, wallet_balance: 450 }] }) // SELECT player after deduction
        .mockResolvedValueOnce({});                                     // INSERT transaction

      const result = await plugin.buyTicket({ playerId: 42, gameRoundId: 1 });

      expect(result.ticket.id).toBe(99);
      expect(result.ticket.game_title).toBe('Test Draw');
      expect(result.ticket.scheduled_draw_at).toBe('2026-07-10T12:00:00Z');
      expect(result.ticket.numbers_to_draw).toBe(6);
      expect(result.ticket.numbers).toEqual(MOCK_TICKET.numbers);

      // Verify the transaction query was made
      const txCall = mockLotteryDb.client.query.mock.calls[3];
      expect(txCall[0]).toContain('INSERT INTO transactions');
      expect(txCall[0]).toContain('ticket_purchase');
      expect(txCall[1]).toContain(42);     // playerId
      expect(txCall[1]).toContain(99);     // ticketId
      expect(txCall[1]).toContain(1);      // gameRoundId
    });
  });

  // ── Ticket query methods ──

  describe('getPlayerTickets', () => {
    it('delegates to ticketsRepo.listByGameAndPlayer', async () => {
      mockTicketsRepo.listByGameAndPlayer.mockResolvedValue([MOCK_TICKET]);

      const result = await plugin.getPlayerTickets(42, 1);
      expect(mockTicketsRepo.listByGameAndPlayer).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual([MOCK_TICKET]);
    });
  });

  describe('getMyTickets', () => {
    it('delegates to ticketsRepo.listByPlayer', async () => {
      mockTicketsRepo.listByPlayer.mockResolvedValue({ tickets: [MOCK_TICKET], total: 1 });

      const result = await plugin.getMyTickets(42);
      expect(mockTicketsRepo.listByPlayer).toHaveBeenCalledWith(42);
      expect(result.tickets).toEqual([MOCK_TICKET]);
    });
  });

  describe('getTicket', () => {
    it('delegates to ticketsRepo.getById', async () => {
      mockTicketsRepo.getById.mockResolvedValue(MOCK_TICKET);

      const result = await plugin.getTicket(99);
      expect(mockTicketsRepo.getById).toHaveBeenCalledWith(99);
      expect(result).toEqual(MOCK_TICKET);
    });
  });

  // ── Draw data methods ──

  describe('getDrawnNumbers', () => {
    it('delegates to drawnNumbersRepo.listByGame', async () => {
      const drawn = [{ number: 3, position: 1 }, { number: 17, position: 2 }];
      mockDrawnNumbersRepo.listByGame.mockResolvedValue(drawn);

      const result = await plugin.getDrawnNumbers(1);
      expect(mockDrawnNumbersRepo.listByGame).toHaveBeenCalledWith(1);
      expect(result).toEqual(drawn);
    });
  });

  describe('getCompletedDraws', () => {
    it('delegates to gameRoundsRepo.getCompletedWithStats', async () => {
      const data = { games: [MOCK_GAME], total: 1 };
      mockGameRoundsRepo.getCompletedWithStats.mockResolvedValue(data);

      const result = await plugin.getCompletedDraws();
      expect(mockGameRoundsRepo.getCompletedWithStats).toHaveBeenCalledOnce();
      expect(result).toEqual(data);
    });
  });

  describe('getScheduledDrawsDue', () => {
    it('delegates to gameRoundsRepo.getScheduledDrawsDue', async () => {
      mockGameRoundsRepo.getScheduledDrawsDue.mockResolvedValue([MOCK_GAME]);

      const result = await plugin.getScheduledDrawsDue();
      expect(mockGameRoundsRepo.getScheduledDrawsDue).toHaveBeenCalledOnce();
      expect(result).toEqual([MOCK_GAME]);
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('returns an empty object (config is per-round)', async () => {
      const cfg = await plugin.getConfig();
      expect(cfg).toEqual({});
    });
  });

  // ── Cross-plugin integration ──

  describe('engine integration', () => {
    it('can play lottery through the engine', async () => {
      setupActiveGame({ tickets_sold: 0 });
      mockPlayersRepo.getById.mockResolvedValue(MOCK_PLAYER);
      mockTicketsRepo.listByGameAndPlayer.mockResolvedValue([]);

      mockLotteryDb.client.query
        .mockResolvedValueOnce({ rows: [{ id: 99 }] })
        .mockResolvedValueOnce({ rows: [MOCK_TICKET] })
        .mockResolvedValueOnce({ rows: [{ ...MOCK_PLAYER, wallet_balance: 450 }] })
        .mockResolvedValueOnce({});

      const result = await engine.play('lottery', 42, { gameRoundId: 1 });
      expect(result.ticket.id).toBe(99);
    });

    it('throws INVALID_INPUT when gameRoundId is missing', async () => {
      await expect(engine.play('lottery', 42, {}))
        .rejects.toThrow('gameRoundId is required');
    });
  });
});

// ─────────────────────────────────────────────────────────
// Cross-plugin integration: GameEngine delegates correctly
// ─────────────────────────────────────────────────────────

describe('GameEngine with multiple plugins', () => {
  let engine;

  beforeEach(async () => {
    setupDefaultConfig();
    engine = createEngine(42);
    await registerAndInit(engine, [
      new KenoPlugin(),
      new SpinPlugin(),
      new RoulettePlugin(),
    ]);
  });

  it('lists all registered game types', () => {
    expect(engine.list().sort()).toEqual(['keno', 'roulette', 'spin']);
  });

  it('delegates play to the correct plugin', async () => {
    const kenoResult = await engine.play('keno', 1, { stake: 50, picks: [1, 2, 3] });
    expect(kenoResult).toHaveProperty('drawn');
    expect(kenoResult).toHaveProperty('hits');

    const spinResult = await engine.play('spin', 1, { stake: 50 });
    expect(spinResult).toHaveProperty('segmentIndex');
    expect(spinResult).toHaveProperty('multiplier');

    const rouletteResult = await engine.play('roulette', 1, { bets: ['even'], stakePerBet: 10 });
    expect(rouletteResult).toHaveProperty('number');
    expect(rouletteResult).toHaveProperty('results');
  });

  it('each play uses the engine RNG (deterministic per seed)', async () => {
    // Two different engines with same seed produce same first play
    const e1 = createEngine(42);
    await registerAndInit(e1, [new KenoPlugin()]);
    const r1 = await e1.play('keno', 1, { stake: 10, picks: [1, 2, 3] });

    const e2 = createEngine(42);
    await registerAndInit(e2, [new KenoPlugin()]);
    const r2 = await e2.play('keno', 1, { stake: 10, picks: [1, 2, 3] });

    expect(r1.drawn).toEqual(r2.drawn);
    expect(r1.hits).toBe(r2.hits);
    expect(r1.payout).toBe(r2.payout);
  });

  it('settlement receives correct parameters from each plugin', async () => {
    const { settleBet } = await import('../WalletSettlement.js');
    settleBet.mockClear();

    await engine.play('keno', 1, { stake: 50, picks: [1, 2, 3] });
    const kenoCall = settleBet.mock.calls[0][0];
    expect(kenoCall.gameType).toBe('keno');
    expect(kenoCall.stake).toBe(50);
    expect(kenoCall.outcome).toHaveProperty('drawn');

    settleBet.mockClear();

    await engine.play('spin', 1, { stake: 100 });
    const spinCall = settleBet.mock.calls[0][0];
    expect(spinCall.gameType).toBe('spin');
    expect(spinCall.stake).toBe(100);
    expect(spinCall.outcome).toHaveProperty('segmentIndex');

    settleBet.mockClear();

    await engine.play('roulette', 1, { bets: ['even', 'red'], stakePerBet: 25 });
    const rouletteCall = settleBet.mock.calls[0][0];
    expect(rouletteCall.gameType).toBe('roulette');
    expect(rouletteCall.stake).toBe(50); // 2 bets × 25
    expect(rouletteCall.outcome).toHaveProperty('number');
    expect(rouletteCall.notes).toBe('roulette stake');
  });
});
