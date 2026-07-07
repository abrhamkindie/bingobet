/**
 * StateMachine — generic finite state machine for game round lifecycle.
 *
 * Each game type plugs in its own state set, transition map, guards, and hooks.
 * All state changes are logged for auditability.
 *
 * @example
 *   const fsm = new StateMachine({
 *     id: 'lottery',
 *     states: ['upcoming', 'active', 'drawing', 'completed', 'cancelled'],
 *     initial: 'upcoming',
 *     transitions: [
 *       { from: 'upcoming', to: 'active', guard: (ctx) => ctx.scheduledAt <= Date.now() },
 *       { from: 'active',   to: 'drawing',  handler: async (ctx) => { await ctx.startDraw(); } },
 *       { from: 'drawing',  to: 'completed' },
 *     ],
 *   });
 */

import { logger } from '../../utils/logger.js';

/**
 * @typedef {{ from: string, to: string, guard?: (ctx:any) => boolean, handler?: (ctx:any) => Promise<void> }} TransitionDef
 */

export class StateMachine {
  /** @param {{ id:string, states:string[], initial:string, transitions:TransitionDef[], hooks?:object }} config */
  constructor({ id, states, initial, transitions, hooks = {} }) {
    this.id = id;
    this.state = initial;
    this.initial = initial;
    this.states = new Set(states);

    // Build transition map: from → { to → { guard?, handler? } }
    /** @type {Map<string, Map<string, {guard?:Function, handler?:Function}>>} */
    this._transitions = new Map();
    for (const t of transitions) {
      if (!this.states.has(t.from)) throw new Error(`StateMachine[${id}]: unknown from state "${t.from}"`);
      if (!this.states.has(t.to)) throw new Error(`StateMachine[${id}]: unknown to state "${t.to}"`);
      if (!this._transitions.has(t.from)) this._transitions.set(t.from, new Map());
      this._transitions.get(t.from).set(t.to, { guard: t.guard, handler: t.handler });
    }

    this.hooks = {
      onEnter: hooks.onEnter || null,
      onLeave: hooks.onLeave || null,
      onError: hooks.onError || null,
    };
  }

  /** Check if a transition from → to is allowed (exists + guard passes). */
  can(from, to, context) {
    const map = this._transitions.get(from);
    if (!map || !map.has(to)) return false;
    const def = map.get(to);
    if (def.guard && !def.guard(context)) return false;
    return true;
  }

  /** All valid target states from the current state. */
  available(context) {
    const map = this._transitions.get(this.state);
    if (!map) return [];
    return Array.from(map.entries())
      .filter(([, def]) => !def.guard || def.guard(context))
      .map(([to]) => to);
  }

  /**
   * Execute a transition from → to.
   * Returns the new state on success, throws on failure.
   */
  async transition(from, to, context) {
    if (this.state !== from) {
      const msg = `StateMachine[${this.id}]: expected state "${from}" but current is "${this.state}"`;
      logger.error(msg, { from, to, current: this.state });
      throw new Error(msg);
    }

    const map = this._transitions.get(from);
    if (!map || !map.has(to)) {
      const msg = `StateMachine[${this.id}]: transition "${from}" → "${to}" not defined`;
      logger.error(msg);
      throw new Error(msg);
    }

    const def = map.get(to);

    if (def.guard && !def.guard(context)) {
      const msg = `StateMachine[${this.id}]: guard rejected transition "${from}" → "${to}"`;
      logger.warn(msg, { context });
      throw new Error(msg);
    }

    try {
      if (this.hooks.onLeave) await this.hooks.onLeave(from, to, context);
      this.state = to;
      if (this.hooks.onEnter) await this.hooks.onEnter(from, to, context);
      if (def.handler) await def.handler(context);

      logger.info('StateMachine transition', {
        machine: this.id,
        from,
        to,
      });

      return to;
    } catch (err) {
      // Rollback state on handler failure
      this.state = from;
      if (this.hooks.onError) await this.hooks.onError(from, to, context, err);
      throw err;
    }
  }

  /** Force-set a state (admin recovery / override). No guard, no hooks. */
  force(state) {
    if (!this.states.has(state)) {
      throw new Error(`StateMachine[${this.id}]: cannot force unknown state "${state}"`);
    }
    const prev = this.state;
    this.state = state;
    logger.warn('StateMachine force', { machine: this.id, from: prev, to: state });
    return state;
  }

  /** Reset to initial state. */
  reset() {
    this.state = this.initial;
  }
}
