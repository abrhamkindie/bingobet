/**
 * @file Global reference to the Telegram bot instance.
 *
 * Admin API routes (e.g. the support tickets route) need to send proactive
 * Telegram messages (e.g. notify a user when an admin replies to their ticket).
 * Rather than threading the bot instance through every route factory, we store
 * it here once at server startup.
 *
 * @module botRef
 */

/** @type {import('grammy').Bot|null} */
let _bot = null;

/**
 * Store the bot instance so admin routes can access it.
 *
 * @param {import('grammy').Bot} bot
 */
export function setBot(bot) {
  _bot = bot;
}

/**
 * Retrieve the stored bot instance.
 *
 * @returns {import('grammy').Bot}
 * @throws {Error} If the bot has not been set yet
 */
export function getBot() {
  if (!_bot) {
    throw new Error('Bot instance not set — call setBot() at startup');
  }
  return _bot;
}
