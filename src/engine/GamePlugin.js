/**
 * GamePlugin — base class for all game type plugins.
 *
 * Each game (Keno, Spin, Roulette, Lottery) implements this interface.
 * The GameEngine discovers and delegates to plugins through these methods.
 *
 * Lifecycle:
 *   1. Constructor — set static metadata (id, label, config defaults)
 *   2. engine.register(plugin) → plugin.init(engine) — called once at startup
 *   3. engine.play('keno', playerId, input) → plugin.play(playerId, input)
 */

import { secureRng } from './RngProvider.js';
import { settleBet } from './WalletSettlement.js';

export class GamePlugin {
  /**
   * @param {object} meta
   * @param {string} meta.id         — unique plugin id ('keno', 'roulette', etc.)
   * @param {string} meta.label      — human-readable name
   * @param {string} [meta.description]
   * @param {object} [meta.metadata] — any extra static info for the frontend
   */
  constructor(meta) {
    if (!meta?.id) throw new Error('GamePlugin requires an id');

    /** @type {string} */
    this.id = meta.id;
    /** @type {string} */
    this.label = meta.label || meta.id;
    /** @type {string} */
    this.description = meta.description || '';

    /** Arbitrary static metadata exposed to the frontend. */
    this.metadata = meta.metadata || {};

    /**
     * Plugin lifecycle state.
     * @type {'created' | 'initialized' | 'ready'}
     */
    this._status = 'created';

    /** @type {import('./RngProvider.js').RngProvider} */
    this.rng = null;

    /** @type {import('./GameEngine.js').GameEngine} */
    this.engine = null;
  }

  /**
   * Called once by GameEngine.register() to set up the plugin.
   * Override to load config, register FSM states, etc.
   *
   * @param {import('./GameEngine.js').GameEngine} engine
   */
  async init(engine) {
    this.engine = engine;
    this.rng = engine.rng;
    this._status = 'initialized';
  }

  /**
   * Called by the engine after all plugins are registered.
   * Override to do any final setup that depends on other plugins.
   */
  async ready() {
    this._status = 'ready';
  }

  /**
   * Validate player input against game config.
   * Throw an appropriate error for invalid input.
   *
   * @param {number} playerId
   * @param {object} input — raw request body
   */
  validate(playerId, input) {
    // Override in subclasses
  }

  /**
   * Execute a game play.
   *
   * 1. validate input
   * 2. check balance / state
   * 3. run game logic (RNG outcome)
   * 4. settle via engine
   * 5. return result
   *
   * @param {number} playerId
   * @param {object} input
   * @returns {Promise<object>} game result
   */
  async play(playerId, input) {
    throw new Error(`GamePlugin[${this.id}]: play() not implemented`);
  }

  /**
   * Get frontend-facing configuration for this game.
   * @returns {Promise<object>}
   */
  async getConfig() {
    return {};
  }

  /**
   * Get play history for a player.
   * @param {number} playerId
   * @param {{ limit?:number, gameType?:string }} [options]
   * @returns {Promise<{bets:object[]}>}
   */
  async getHistory(playerId, { limit = 30 } = {}) {
    const { query } = await import('../db/index.js');
    const { rows } = await query(
      `SELECT id, game_type, stake, payout, multiplier, outcome, created_at
         FROM instant_bets
        WHERE player_id = $1 AND game_type = $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [playerId, this.id, limit]
    );
    return { bets: rows };
  }

  /**
   * Convenience: settle a bet through the engine's settlement module.
   */
  async settle({ playerId, stake, payout, multiplier, outcome, notes }) {
    return settleBet({
      playerId,
      gameType: this.id,
      stake,
      payout,
      multiplier,
      outcome,
      notes,
    });
  }
}
