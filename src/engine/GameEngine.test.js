import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRngProvider, secureRng } from './RngProvider.js';
import { StateMachine } from './fsm/StateMachine.js';
import { GamePlugin } from './GamePlugin.js';
import { GameEngine } from './GameEngine.js';

// ─────────────────────────────────────────────────────────
// RngProvider
// ─────────────────────────────────────────────────────────

describe('RngProvider', () => {
  describe('createRngProvider (seeded / deterministic)', () => {
    it('returns deterministic sequences from the same seed', () => {
      const a = createRngProvider(42);
      const b = createRngProvider(42);
      for (let i = 0; i < 20; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    it('returns different sequences from different seeds', () => {
      const a = createRngProvider(1);
      const b = createRngProvider(2);
      // First value should differ
      expect(a.next()).not.toBe(b.next());
    });

    it('next() returns values in [0, 1)', () => {
      const rng = createRngProvider(99);
      for (let i = 0; i < 100; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('int(min, max) returns values in the inclusive range', () => {
      const rng = createRngProvider(42);
      for (let i = 0; i < 100; i++) {
        const v = rng.int(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      }
    });

    it('int() covers both bounds over many iterations', () => {
      const rng = createRngProvider(42);
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        seen.add(rng.int(0, 5));
      }
      // With 200 draws from 6 values, we should see all of them
      expect(seen.size).toBe(6);
    });

    it('shuffle() returns all original elements in a different order (usually)', () => {
      const rng = createRngProvider(42);
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...input];
      const shuffled = rng.shuffle([...input]);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort((a, b) => a - b)).toEqual(original);
    });

    it('shuffle() handles empty array', () => {
      const rng = createRngProvider(42);
      expect(rng.shuffle([])).toEqual([]);
    });

    it('shuffle() handles single element', () => {
      const rng = createRngProvider(42);
      expect(rng.shuffle([99])).toEqual([99]);
    });
  });

  describe('secureRng (production)', () => {
    it('next() returns values in [0, 1)', () => {
      for (let i = 0; i < 20; i++) {
        const v = secureRng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('int(min, max) returns values in the inclusive range', () => {
      for (let i = 0; i < 20; i++) {
        const v = secureRng.int(1, 6);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────
// StateMachine
// ─────────────────────────────────────────────────────────

describe('StateMachine', () => {
  const states = ['idle', 'running', 'paused', 'completed', 'failed'];
  const initial = 'idle';

  const transitions = [
    { from: 'idle', to: 'running' },
    { from: 'running', to: 'paused', guard: (ctx) => ctx.canPause !== false },
    { from: 'paused', to: 'running' },
    { from: 'running', to: 'completed', handler: async (ctx) => { ctx._done = true; } },
    { from: 'running', to: 'failed' },
    { from: 'paused', to: 'failed' },
  ];

  let fsm;

  beforeEach(() => {
    fsm = new StateMachine({ id: 'test', states, initial, transitions });
  });

  describe('constructor', () => {
    it('starts in the initial state', () => {
      expect(fsm.state).toBe('idle');
      expect(fsm.initial).toBe('idle');
    });

    it('throws on invalid from state', () => {
      expect(() => new StateMachine({
        id: 'bad', states: ['a'], initial: 'a',
        transitions: [{ from: 'bogus', to: 'a' }],
      })).toThrow('unknown from state');
    });

    it('throws on invalid to state', () => {
      expect(() => new StateMachine({
        id: 'bad', states: ['a'], initial: 'a',
        transitions: [{ from: 'a', to: 'bogus' }],
      })).toThrow('unknown to state');
    });
  });

  describe('can()', () => {
    it('returns true for a valid transition without guard', () => {
      expect(fsm.can('idle', 'running', {})).toBe(true);
    });

    it('returns true when guard passes', () => {
      expect(fsm.can('running', 'paused', { canPause: true })).toBe(true);
    });

    it('returns false when guard rejects', () => {
      expect(fsm.can('running', 'paused', { canPause: false })).toBe(false);
    });

    it('returns false for undefined transition', () => {
      expect(fsm.can('idle', 'completed', {})).toBe(false);
    });

    it('returns false for non-existent state', () => {
      expect(fsm.can('idle', 'nonexistent', {})).toBe(false);
    });
  });

  describe('available()', () => {
    it('lists all allowed target states from current state', () => {
      expect(fsm.available({})).toEqual(['running']);
    });

    it('includes guard-passing transitions and excludes guard-failing ones', () => {
      fsm.state = 'running';
      expect(fsm.available({ canPause: true }).sort()).toEqual(['completed', 'failed', 'paused']);
      expect(fsm.available({ canPause: false }).sort()).toEqual(['completed', 'failed']);
    });

    it('returns empty array for final states with no outgoing transitions', () => {
      fsm.state = 'completed';
      expect(fsm.available({})).toEqual([]);
    });
  });

  describe('transition()', () => {
    it('executes a simple transition and updates state', async () => {
      await fsm.transition('idle', 'running', {});
      expect(fsm.state).toBe('running');
    });

    it('rejects if current state does not match from', async () => {
      await expect(fsm.transition('running', 'paused', {})).rejects.toThrow(
        'expected state "running" but current is "idle"'
      );
      expect(fsm.state).toBe('idle'); // state unchanged
    });

    it('rejects if transition is not defined', async () => {
      await expect(fsm.transition('idle', 'completed', {})).rejects.toThrow(
        'transition "idle" → "completed" not defined'
      );
      expect(fsm.state).toBe('idle');
    });

    it('rejects if guard fails', async () => {
      fsm.state = 'running';
      await expect(fsm.transition('running', 'paused', { canPause: false })).rejects.toThrow(
        'guard rejected transition'
      );
      expect(fsm.state).toBe('running'); // unchanged
    });

    it('executes the handler during a successful transition', async () => {
      const ctx = { _done: false };
      fsm.state = 'running';
      await fsm.transition('running', 'completed', ctx);
      expect(ctx._done).toBe(true);
      expect(fsm.state).toBe('completed');
    });

    it('rolls back state if handler throws', async () => {
      const badFsm = new StateMachine({
        id: 'bad', states: ['a', 'b'], initial: 'a',
        transitions: [{ from: 'a', to: 'b', handler: async () => { throw new Error('boom'); } }],
      });
      await expect(badFsm.transition('a', 'b', {})).rejects.toThrow('boom');
      expect(badFsm.state).toBe('a'); // rolled back
    });

    it('calls onLeave and onEnter hooks', async () => {
      const calls = [];
      const hookFsm = new StateMachine({
        id: 'hooks', states: ['a', 'b'], initial: 'a',
        transitions: [{ from: 'a', to: 'b' }],
        hooks: {
          onLeave: (from, to) => calls.push(`leave:${from}->${to}`),
          onEnter: (from, to) => calls.push(`enter:${from}->${to}`),
        },
      });
      await hookFsm.transition('a', 'b', {});
      expect(calls).toEqual(['leave:a->b', 'enter:a->b']);
    });

    it('calls onError if a handler fails', async () => {
      const calls = [];
      const errFsm = new StateMachine({
        id: 'err', states: ['a', 'b'], initial: 'a',
        transitions: [{ from: 'a', to: 'b', handler: async () => { throw new Error('handler fail'); } }],
        hooks: { onError: (from, to, ctx, err) => calls.push({ from, to, msg: err.message }) },
      });
      await expect(errFsm.transition('a', 'b', {})).rejects.toThrow('handler fail');
      expect(calls).toEqual([{ from: 'a', to: 'b', msg: 'handler fail' }]);
    });
  });

  describe('force()', () => {
    it('sets the state directly without running guards or hooks', () => {
      fsm.force('completed');
      expect(fsm.state).toBe('completed');
    });

    it('throws for an unknown state', () => {
      expect(() => fsm.force('nonexistent')).toThrow('cannot force unknown state');
    });

    it('returns the new state', () => {
      expect(fsm.force('failed')).toBe('failed');
    });
  });

  describe('reset()', () => {
    it('resets state back to the initial state', () => {
      fsm.state = 'completed';
      fsm.reset();
      expect(fsm.state).toBe('idle');
    });
  });
});

// ─────────────────────────────────────────────────────────
// GamePlugin
// ─────────────────────────────────────────────────────────

describe('GamePlugin', () => {
  it('requires an id in the constructor', () => {
    expect(() => new GamePlugin()).toThrow('GamePlugin requires an id');
    expect(() => new GamePlugin({})).toThrow('GamePlugin requires an id');
  });

  it('stores meta properties', () => {
    const p = new GamePlugin({ id: 'test', label: 'Test Game', description: 'A test', metadata: { foo: 1 } });
    expect(p.id).toBe('test');
    expect(p.label).toBe('Test Game');
    expect(p.description).toBe('A test');
    expect(p.metadata).toEqual({ foo: 1 });
  });

  it('defaults label to id if not provided', () => {
    const p = new GamePlugin({ id: 'foo' });
    expect(p.label).toBe('foo');
  });

  it('defaults metadata to empty object', () => {
    const p = new GamePlugin({ id: 'bar' });
    expect(p.metadata).toEqual({});
  });

  it('starts with _status = "created"', () => {
    const p = new GamePlugin({ id: 'x' });
    expect(p._status).toBe('created');
  });

  it('init() sets engine, rng, and updates _status', async () => {
    const p = new GamePlugin({ id: 'x' });
    const engine = { rng: 'fake-rng' };
    await p.init(engine);
    expect(p.engine).toBe(engine);
    expect(p.rng).toBe('fake-rng');
    expect(p._status).toBe('initialized');
  });

  it('ready() sets _status to "ready"', async () => {
    const p = new GamePlugin({ id: 'x' });
    await p.ready();
    expect(p._status).toBe('ready');
  });

  it('play() throws "not implemented" by default', async () => {
    const p = new GamePlugin({ id: 'x' });
    await expect(p.play(1, {})).rejects.toThrow('play() not implemented');
  });

  it('getConfig() returns empty object by default', async () => {
    const p = new GamePlugin({ id: 'x' });
    await expect(p.getConfig()).resolves.toEqual({});
  });

  it('validate() does nothing by default (no throw)', () => {
    const p = new GamePlugin({ id: 'x' });
    expect(() => p.validate(1, {})).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// GameEngine
// ─────────────────────────────────────────────────────────

describe('GameEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ rng: createRngProvider(42) });
  });

  it('starts with no plugins and not initialized', () => {
    expect(engine.plugins.size).toBe(0);
    expect(engine._initialized).toBe(false);
    expect(engine.list()).toEqual([]);
  });

  describe('register()', () => {
    it('registers a plugin and gives it the engine', () => {
      const p = new GamePlugin({ id: 'mygame' });
      engine.register(p);
      expect(engine.get('mygame')).toBe(p);
      expect(p.engine).toBe(engine);
      expect(p.rng).toBe(engine.rng);
    });

    it('throws if a plugin with the same id is registered twice', () => {
      engine.register(new GamePlugin({ id: 'dup' }));
      expect(() => engine.register(new GamePlugin({ id: 'dup' }))).toThrow(
        'plugin "dup" is already registered'
      );
    });

    it('is chainable', () => {
      const r = engine.register(new GamePlugin({ id: 'a' }));
      expect(r).toBe(engine);
    });
  });

  describe('get()', () => {
    it('returns the plugin by id', () => {
      const p = new GamePlugin({ id: 'findme' });
      engine.register(p);
      expect(engine.get('findme')).toBe(p);
    });

    it('returns undefined for unknown id', () => {
      expect(engine.get('nonexistent')).toBeUndefined();
    });
  });

  describe('list()', () => {
    it('returns all registered plugin ids', () => {
      engine.register(new GamePlugin({ id: 'a' }));
      engine.register(new GamePlugin({ id: 'b' }));
      expect(engine.list().sort()).toEqual(['a', 'b']);
    });
  });

  describe('init()', () => {
    it('calls init() and ready() on all registered plugins', async () => {
      const a = new GamePlugin({ id: 'a' });
      const b = new GamePlugin({ id: 'b' });
      const initSpyA = vi.spyOn(a, 'init');
      const initSpyB = vi.spyOn(b, 'init');
      const readySpyA = vi.spyOn(a, 'ready');
      const readySpyB = vi.spyOn(b, 'ready');

      engine.register(a);
      engine.register(b);
      await engine.init();

      expect(initSpyA).toHaveBeenCalledOnce();
      expect(initSpyB).toHaveBeenCalledOnce();
      expect(readySpyA).toHaveBeenCalledOnce();
      expect(readySpyB).toHaveBeenCalledOnce();
      expect(engine._initialized).toBe(true);
    });
  });

  describe('play()', () => {
    it('delegates to the correct plugin and returns its result', async () => {
      class TestPlugin extends GamePlugin {
        async play(playerId, input) {
          return { playerId, ...input, played: true };
        }
      }
      const p = new TestPlugin({ id: 'testgame' });
      engine.register(p);
      const result = await engine.play('testgame', 42, { foo: 'bar' });
      expect(result).toEqual({ playerId: 42, foo: 'bar', played: true });
    });

    it('throws for unknown game type', async () => {
      await expect(engine.play('nonexistent', 1, {})).rejects.toThrow('Unknown game type');
    });
  });

  describe('getConfig()', () => {
    it('delegates to the correct plugin', async () => {
      class TestPlugin extends GamePlugin {
        async getConfig() { return { mode: 'test' }; }
      }
      engine.register(new TestPlugin({ id: 'cfgtest' }));
      await expect(engine.getConfig('cfgtest')).resolves.toEqual({ mode: 'test' });
    });

    it('throws for unknown game type', async () => {
      await expect(engine.getConfig('nope')).rejects.toThrow('Unknown game type');
    });
  });

  describe('getHistory()', () => {
    it('throws for unknown game type with gameType specified', async () => {
      await expect(engine.getHistory('nope', 1)).rejects.toThrow('Unknown game type');
    });
  });

  describe('createLifecycleFSM()', () => {
    it('creates a StateMachine with canonical game lifecycle states', () => {
      const fsm = GameEngine.createLifecycleFSM('testgame');
      expect(fsm).toBeInstanceOf(StateMachine);
      expect(fsm.id).toBe('testgame');
      expect(fsm.initial).toBe('upcoming');
      expect(fsm.state).toBe('upcoming');
    });

    it('includes common transitions', () => {
      const fsm = GameEngine.createLifecycleFSM('x');
      expect(fsm.can('active', 'drawing', {})).toBe(true);
      expect(fsm.can('drawing', 'completed', {})).toBe(true);
      expect(fsm.can('active', 'cancelled', {})).toBe(true);
    });

    it('includes the scheduledAt guard', () => {
      const fsm = GameEngine.createLifecycleFSM('x');
      // Guard: if scheduledAt is set and in future, can't transition to active
      const future = Date.now() + 999999;
      expect(fsm.can('upcoming', 'active', { scheduledAt: future })).toBe(false);
      // If no scheduledAt, guard passes
      expect(fsm.can('upcoming', 'active', { scheduledAt: null })).toBe(true);
    });

    it('accepts game-specific extra transitions within existing states', () => {
      const fsm = GameEngine.createLifecycleFSM('y', [
        { from: 'drawing', to: 'cancelled' },
      ]);
      expect(fsm.can('drawing', 'cancelled', {})).toBe(true);
    });
  });

  describe('full lifecycle (register + init + play)', () => {
    it('works end-to-end with a mock plugin', async () => {
      const e = new GameEngine({ rng: createRngProvider(42) });

      class MockGame extends GamePlugin {
        async play(playerId, input) {
          return { id: playerId, number: this.rng.int(1, 100) };
        }
      }

      e.register(new MockGame({ id: 'mock' }));
      await e.init();

      expect(e._initialized).toBe(true);
      expect(e.list()).toEqual(['mock']);

      const result = await e.play('mock', 7, {});
      expect(result.id).toBe(7);
      expect(result.number).toBeGreaterThanOrEqual(1);
      expect(result.number).toBeLessThanOrEqual(100);
    });
  });
});

// ─────────────────────────────────────────────────────────
// WalletSettlement — tests with mocked DB
// ─────────────────────────────────────────────────────────

describe('WalletSettlement', () => {
  beforeEach(() => {
    // Mock the db/index module that WalletSettlement imports
    vi.mock('../db/index.js', () => ({
      withTransaction: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('deducts stake and credits payout, records bet + transactions', async () => {
    const { withTransaction } = await import('../db/index.js');

    const mockClient = {
      query: vi.fn()
        // SELECT player for UPDATE
        .mockResolvedValueOnce({ rows: [{ wallet_balance: '200.00' }] })
        // UPDATE players
        .mockResolvedValueOnce({})
        // INSERT instant_bets RETURNING id
        .mockResolvedValueOnce({ rows: [{ id: 99 }] })
        // INSERT bet transaction
        .mockResolvedValueOnce({})
        // INSERT payout transaction
        .mockResolvedValueOnce({}),
    };

    withTransaction.mockImplementation(async (fn) => fn(mockClient));

    const { settleBet } = await import('./WalletSettlement.js');
    const result = await settleBet({
      playerId: 1,
      gameType: 'keno',
      stake: 50,
      payout: 100,
      multiplier: 2,
      outcome: { picks: [1, 2, 3], drawn: [2, 5, 8], hits: 1 },
      notes: 'keno stake',
    });

    // Assert
    expect(result).toEqual({ betId: 99, balance: 250 }); // 200 - 50 + 100 = 250

    // Should have locked the player row
    expect(mockClient.query).toHaveBeenNthCalledWith(
      1,
      'SELECT wallet_balance FROM players WHERE id = $1 FOR UPDATE',
      [1]
    );

    // Should have updated player wallet
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE players'),
      [1, 250, 50, 100]
    );

    // Should have inserted the bet
    const call3 = mockClient.query.mock.calls[2];
    expect(call3[0]).toContain('INSERT INTO instant_bets');
    expect(call3[1]).toEqual([1, 'keno', 50, 100, 2, expect.any(String)]);

    // Should have created both bet and payout transactions (with payout > 0)
    const txCalls = mockClient.query.mock.calls.slice(3);
    expect(txCalls.length).toBe(2);
    // The 'bet' type and 'completed' status are hardcoded in the SQL string, not params
    expect(txCalls[0][1]).toEqual([1, 50, 200, 150, 'KENO-99-B', 'keno stake']);
    expect(txCalls[1][1]).toEqual([1, 100, 150, 250, 'KENO-99-P', 'keno stake win']);
  });

  it('skips payout transaction when payout is 0', async () => {
    const { withTransaction } = await import('../db/index.js');

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ wallet_balance: '100.00' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 42 }] })
        .mockResolvedValueOnce({}),
    };

    withTransaction.mockImplementation(async (fn) => fn(mockClient));

    const { settleBet } = await import('./WalletSettlement.js');
    const result = await settleBet({
      playerId: 2,
      gameType: 'spin',
      stake: 20,
      payout: 0,
      multiplier: 0,
      outcome: { segmentIndex: 0, multiplier: 0 },
    });

    expect(result).toEqual({ betId: 42, balance: 80 }); // 100 - 20 + 0 = 80

    // Only 4 queries: SELECT, UPDATE, INSERT bet, INSERT bet-tx (no payout tx)
    expect(mockClient.query).toHaveBeenCalledTimes(4);
  });

  it('throws PLAYER_NOT_FOUND when player row is empty', async () => {
    const { withTransaction } = await import('../db/index.js');

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] }), // no player found
    };

    withTransaction.mockImplementation(async (fn) => fn(mockClient));

    const { settleBet } = await import('./WalletSettlement.js');
    await expect(settleBet({
      playerId: 999,
      gameType: 'roulette',
      stake: 10,
      payout: 0,
      multiplier: 0,
      outcome: {},
    })).rejects.toThrow('Player not found');
  });

  it('throws INSUFFICIENT_BALANCE when stake > balance', async () => {
    const { withTransaction } = await import('../db/index.js');

    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ wallet_balance: '30.00' }] }), // only 30, needs 50
    };

    withTransaction.mockImplementation(async (fn) => fn(mockClient));

    const { settleBet } = await import('./WalletSettlement.js');
    await expect(settleBet({
      playerId: 3,
      gameType: 'keno',
      stake: 50,
      payout: 0,
      multiplier: 0,
      outcome: {},
    })).rejects.toThrow('Insufficient balance');
  });
});
