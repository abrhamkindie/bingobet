import { config } from '../../config/index.js';
import { mainKeyboard, languageKeyboard } from '../keyboards.js';
import { logger } from '../../utils/logger.js';

export function registerStart(bot) {
  bot.command('start', async (ctx) => {
    logger.info('start command', { telegramId: ctx.from?.id });

    const miniAppUrl = `${config.publicUrl}/miniapp/`;

    // First time users - choose language
    if (ctx.dbPlayer?.is_new) {
      await ctx.reply(ctx.t('start.choose_language'), {
        reply_markup: languageKeyboard(ctx.t),
      });
      return;
    }

    // Welcome back - Mini App first
    const isAdmin = ctx.dbPlayer?.role === 'admin';
    await ctx.reply(
      ctx.t('start.welcome_back', { name: ctx.dbPlayer?.name || 'Player' }),
      { reply_markup: mainKeyboard(ctx.t, isAdmin, miniAppUrl) }
    );
  });

  // Handle "back to main menu"
  bot.callbackQuery('start:welcome', async (ctx) => {
    await ctx.answerCallbackQuery();
    const miniAppUrl = `${config.publicUrl}/miniapp/`;
    const isAdmin = ctx.dbPlayer?.role === 'admin';
    await ctx.editMessageText(
      ctx.t('start.welcome_back', { name: ctx.dbPlayer?.name || 'Player' }),
      { reply_markup: mainKeyboard(ctx.t, isAdmin, miniAppUrl) }
    );
  });
}
