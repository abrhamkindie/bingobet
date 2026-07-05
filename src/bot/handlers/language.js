import { config } from '../../config/index.js';
import * as playersRepo from '../../db/repositories/players.js';
import { mainKeyboard, languageKeyboard } from '../keyboards.js';
import { getTranslator } from '../../i18n/index.js';

export function registerLanguage(bot) {
  // Language selection via callback
  bot.callbackQuery(/^lang:(en|am)$/, async (ctx) => {
    const lang = ctx.match[1];
    await ctx.answerCallbackQuery();
    
    await playersRepo.setLanguage(ctx.from.id, lang);

    const t = getTranslator(lang);
    const msg = t('start.language_set');
    const isAdmin = ctx.dbPlayer?.role === 'admin';
    const miniAppUrl = `${config.publicUrl}/miniapp/`;

    if (ctx.dbPlayer?.is_new) {
      await ctx.editMessageText(
        t('start.welcome', { name: ctx.dbPlayer?.name || 'Player' }),
        { reply_markup: mainKeyboard(t, isAdmin, miniAppUrl) }
      );
    } else {
      await ctx.editMessageText(msg, {
        reply_markup: mainKeyboard(t, isAdmin, miniAppUrl),
      });
    }
  });

  // /language command
  bot.command('language', async (ctx) => {
    await ctx.reply(ctx.t('start.choose_language'), {
      reply_markup: languageKeyboard(ctx.t),
    });
  });
}
