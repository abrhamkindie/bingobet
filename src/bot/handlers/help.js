import { config } from '../../config/index.js';
import { mainKeyboard } from '../keyboards.js';

export function registerHelp(bot) {
  bot.callbackQuery('help:show', async (ctx) => {
    await ctx.answerCallbackQuery();
    const isAdmin = ctx.dbPlayer?.role === 'admin';
    const miniAppUrl = `${config.publicUrl}/miniapp/`;
    const text = `${ctx.t('help.intro')}\n\n${ctx.t('help.how_to_play')}\n\n${ctx.t('help.prizes')}\n\n${ctx.t('help.faq')}`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard(ctx.t, isAdmin, miniAppUrl),
    });
  });

  bot.command('help', async (ctx) => {
    const isAdmin = ctx.dbPlayer?.role === 'admin';
    const miniAppUrl = `${config.publicUrl}/miniapp/`;
    await ctx.reply(`${ctx.t('help.intro')}\n\n${ctx.t('help.how_to_play')}\n\n${ctx.t('help.prizes')}`, {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard(ctx.t, isAdmin, miniAppUrl),
    });
  });
}
