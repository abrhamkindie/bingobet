import { Bot } from 'grammy';
import { config, assertBotConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { playerMiddleware } from './middlewares/player.js';
import { registerStart } from './handlers/start.js';
import { registerGames } from './handlers/games.js';
import { registerTickets } from './handlers/tickets.js';
import { registerWallet } from './handlers/wallet.js';
import { registerDraw } from './handlers/draw.js';
import { registerResults } from './handlers/results.js';
import { registerAdmin } from './handlers/admin.js';
import { registerHelp } from './handlers/help.js';
import { registerLanguage } from './handlers/language.js';

export function createBot() {
  assertBotConfig();
  const bot = new Bot(config.botToken);

  // Trace incoming updates
  bot.use(async (ctx, next) => {
    const u = ctx.update;
    const kind = u.message
      ? u.message.text
        ? `message:text "${u.message.text.slice(0, 40)}"`
        : 'message:other'
      : u.callback_query
        ? `callback "${u.callback_query.data}"`
        : 'unknown';
    logger.info('update', { from: ctx.from?.id, kind });
    await next();
  });

  // Attach player and translator
  bot.use(playerMiddleware());

  // Register all handlers
  registerStart(bot);
  registerLanguage(bot);
  registerGames(bot);
  registerTickets(bot);
  registerWallet(bot);
  registerDraw(bot);
  registerResults(bot);
  registerAdmin(bot);
  registerHelp(bot);

  // Global error handler
  bot.catch((err) => {
    logger.error('bot error', {
      update_id: err.ctx?.update?.update_id,
      error: err.error?.message || String(err.error),
    });
  });

  return bot;
}
