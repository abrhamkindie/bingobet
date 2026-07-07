/**
 * GameEngine singleton.
 *
 * Created at import time (empty — no plugins registered).
 * Call initEngine() at app startup to register plugins and initialize.
 *
 * Old service files import the engine singleton to delegate calls,
 * avoiding circular dependencies since plugins import pure helpers
 * from those same service files.
 */

import { GameEngine } from './GameEngine.js';

let _initialized = false;

/** @type {GameEngine} */
export const engine = new GameEngine();

/**
 * Register all game plugins and initialize the engine.
 * Call once at app startup (src/index.js) after DB connection.
 */
export async function initEngine() {
  if (_initialized) return;

  // Dynamic imports to avoid circular deps:
  //   engine/index → plugins/* → services/instantGamesService
  //   services/instantGamesService → engine/index (circular!)
  const { KenoPlugin } = await import('./plugins/KenoPlugin.js');
  const { SpinPlugin } = await import('./plugins/SpinPlugin.js');
  const { RoulettePlugin } = await import('./plugins/RoulettePlugin.js');
  const { LotteryPlugin } = await import('./plugins/LotteryPlugin.js');

  engine.register(new KenoPlugin());
  engine.register(new SpinPlugin());
  engine.register(new RoulettePlugin());
  engine.register(new LotteryPlugin());

  await engine.init();
  _initialized = true;
}
