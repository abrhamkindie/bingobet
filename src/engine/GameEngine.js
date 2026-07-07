/**
 * GameEngine — central orchestrator for all game types.
 *
 * Manages plugin registration, lifecycles, and delegates play/getConfig/getHistory
 * to the appropriate plugin by game type.
 *
 * @example
 *   import { GameEngine } from './engine/GameEngine.js';
 *   import { KenoPlugin } from './engine/plugins/KenoPlugin.js';
 *   import { RoulettePlugin } from './engine/plugins/RoulettePlugin.js';
 *
 *   const engine = new GameEngine();
 *   engine.register(new KenoPlugin());
 *   engine.register(new RoulettePlugin());
 *   await engine.init();
 *
 *   const result = await engine.play('keno', playerId, { stake: 10, picks: [1,2,3] });
 */

import { secureRng } from './RngProvider.js';
import { settleBet } from './WalletSettlement.js';
import { StateMachine } from './fsm/StateMachine.js';
import { logger } from '../utils/logger.js';

export class GameEngine {
  /**
   * @param {object} [options]
   * @param {import('./RngProvider.js').RngProvider} [options.rng]
   * @param {typeof import('./WalletSettlement.js').settleBet} [options.settle]
   */
  constructor({ rng = secureRng, settle = settleBet } = {}) {
    /** @type {Map<string, import('./GamePlugin.js').GamePlugin>} */
    this.plugins = new Map();
    this.rng = rng;
    this.settle = settle;
    this._initialized = false;
  }

  // ── Plugin management ──────────────────────────────────

  /**
   * Register a game plugin.
   * Calls plugin.init(this) to give the plugin access to the engine.
   */
  register(plugin) {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`GameEngine: plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    plugin.engine = this;
    plugin.rng = this.rng;
    return this;
  }

  /**
   * Initialize all registered plugins.
   * Call this once after all plugins are registered.
   */
  async init() {
    logger.info(`GameEngine initialising with ${this.plugins.size} plugin(s)`);
    for (const [, plugin] of this.plugins) {
      await plugin.init(this);
    }
    for (const [, plugin] of this.plugins) {
      await plugin.ready();
    }
    this._initialized = true;
    logger.info('GameEngine ready', { plugins: Array.from(this.plugins.keys()) });
  }

  /**
   * Get a registered plugin by id.
   * @param {string} id
   * @returns {import('./GamePlugin.js').GamePlugin|undefined}
   */
  get(id) {
    return this.plugins.get(id);
  }

  /**
   * List all registered game type ids.
   * @returns {string[]}
   */
  list() {
    return Array.from(this.plugins.keys());
  }

  // ── Game actions ───────────────────────────────────────

  /**
   * Play a game.
   * Delegates to plugin.play(playerId, input).
   *
   * @param {string} gameType — plugin id
   * @param {number} playerId
   * @param {object} input
   * @returns {Promise<object>}
   */
  async play(gameType, playerId, input) {
    const plugin = this.plugins.get(gameType);
    if (!plugin) throw new Error(`Unknown game type: "${gameType}"`);
    return plugin.play(playerId, input);
  }

  /**
   * Get frontend config for a game type.
   * @param {string} gameType
   * @returns {Promise<object>}
   */
  async getConfig(gameType) {
    const plugin = this.plugins.get(gameType);
    if (!plugin) throw new Error(`Unknown game type: "${gameType}"`);
    return plugin.getConfig();
  }

  /**
   * Get play history for a player across one or all game types.
   * If gameType is specified, delegates to that plugin.
   * Otherwise, queries the shared instant_bets table directly.
   *
   * @param {string} [gameType]
   * @param {number} playerId
   * @param {{ limit?:number }} [options]
   * @returns {Promise<{bets:object[]}>}
   */
  async getHistory(gameType, playerId, { limit = 30 } = {}) {
    if (gameType) {
      const plugin = this.plugins.get(gameType);
      if (!plugin) throw new Error(`Unknown game type: "${gameType}"`);
      return plugin.getHistory(playerId, { limit });
    }

    // All types combined
    const { query } = await import('../db/index.js');
    const { rows } = await query(
      `SELECT id, game_type, stake, payout, multiplier, outcome, created_at
         FROM instant_bets
        WHERE player_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [playerId, limit]
    );
    return { bets: rows };
  }

  /**
   * Convenience: create a shared StateMachine for all games.
   * Plugins can call this to reuse the canonical game lifecycle FSM.
   */
  static createLifecycleFSM(id, gameSpecificTransitions = []) {
    const commonTransitions = [
      { from: 'upcoming', to: 'active',    guard: (ctx) => ctx.scheduledAt ? Date.now() >= new Date(ctx.scheduledAt).getTime() : true },
      { from: 'active',   to: 'drawing' },
      { from: 'drawing',  to: 'completed' },
      { from: 'active',   to: 'cancelled' },
      { from: 'upcoming', to: 'cancelled' },
    ];

    return new StateMachine({
      id,
      states: ['upcoming', 'active', 'drawing', 'completed', 'cancelled'],
      initial: 'upcoming',
      transitions: [...commonTransitions, ...gameSpecificTransitions],
    });
  }
}
