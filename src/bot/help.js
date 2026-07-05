/**
 * Interactive help / support system.
 *
 * Provides a role-aware, category-based help menu with inline keyboard
 * navigation so users can browse topics without leaving the chat.
 *
 * @module bot/help
 */

import { InlineKeyboard } from 'grammy';
import { botAsyncHandler } from './utils/botError.js';
import { startTicketFlow } from './handlers/support.js';

/**
 * Builds the help category keyboard for the given role.
 *
 * @param {import('../../i18n/index.js').Translator} t - Translator bound to the user's locale
 * @param {'driver'|'host'} role - The user's role
 * @returns {InlineKeyboard}
 */
export function helpMenuKeyboard(t, role) {
  const kb = new InlineKeyboard();

  if (role === 'host') {
    kb.text(t('help.category.host_overview'), 'help:content:host_overview').row();
    kb.text(t('help.category.host_listing'), 'help:content:host_listing').row();
    kb.text(t('help.category.host_manage'), 'help:content:host_manage').row();
    kb.text(t('help.category.host_handling'), 'help:content:host_handling').row();
    kb.text(t('help.category.host_payments'), 'help:content:host_payments').row();
    kb.text(t('help.category.host_faq'), 'help:content:host_faq').row();
  } else {
    kb.text(t('help.category.driver_overview'), 'help:content:driver_overview').row();
    kb.text(t('help.category.driver_find'), 'help:content:driver_find').row();
    kb.text(t('help.category.driver_booking'), 'help:content:driver_booking').row();
    kb.text(t('help.category.driver_manage'), 'help:content:driver_manage').row();
    kb.text(t('help.category.driver_checkin'), 'help:content:driver_checkin').row();
    kb.text(t('help.category.driver_host'), 'help:content:driver_host').row();
    kb.text(t('help.category.driver_faq'), 'help:content:driver_faq').row();
  }

  kb.row().text(t('help.category.contact'), 'help:content:contact');
  return kb;
}

/**
 * Sends (or edits) the main help menu with category buttons.
 *
 * @param {import('grammy').Context} ctx - Grammy context
 * @param {'driver'|'host'} [role] - Override role (defaults to ctx.dbUser.role)
 * @param {number} [messageId] - If set, edit an existing message instead of sending a new one
 */
export async function showHelpMenu(ctx, role, messageId) {
  role = role || ctx.dbUser?.role || 'driver';
  const t = ctx.t;
  const text = `*${t('help.menu_title')}*`;

  const kb = helpMenuKeyboard(t, role);

  if (messageId) {
    try {
      await ctx.editMessageText(text, {
        reply_markup: kb,
        parse_mode: 'Markdown',
      });
    } catch {
      // Editing may fail if the message is too old or from another chat
      await ctx.reply(text, { reply_markup: kb, parse_mode: 'Markdown' });
    }
  } else {
    await ctx.reply(text, { reply_markup: kb, parse_mode: 'Markdown' });
  }
}

/**
 * Returns the help content text for the given topic key, or null if not found.
 *
 * @param {import('../../i18n/index.js').Translator} t - Translator bound to the user's locale
 * @param {string} topicKey - The content key (e.g. "driver_overview", "contact")
 * @returns {string|null}
 */
function getHelpContent(t, topicKey) {
  try {
    const content = t(`help.content.${topicKey}`);
    // The translator returns the key unchanged if it's missing
    if (content && !content.startsWith('help.content.')) {
      return content;
    }
  } catch {
    // Key not found
  }
  return null;
}

/**
 * Register help-related callback query handlers on the bot.
 *
 * @param {import('grammy').Bot} bot - Grammy bot instance
 */
export function registerHelp(bot) {
  // Show the main help menu (called from /help command or menu button).
  bot.callbackQuery('help:show', botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await showHelpMenu(ctx, ctx.dbUser?.role || 'driver');
  }));

  // Show content for a specific topic.
  bot.callbackQuery(/^help:content:(.+)$/, botAsyncHandler(async (ctx) => {
    const topicKey = ctx.match[1];
    await ctx.answerCallbackQuery();

    const t = ctx.t;
    const content = getHelpContent(t, topicKey);

    if (!content) {
      // Fallback: show help menu
      await showHelpMenu(ctx);
      return;
    }

    // Build a "Back to topics" + "Contact Support" footer
    const backKb = new InlineKeyboard()
      .text(t('help.back'), 'help:show');

    if (topicKey === 'contact') {
      // Contact page: add "Submit a Ticket" button
      backKb.text(t('support.new_ticket_button'), 'ticket:start:help');
    } else {
      backKb.text(t('help.contact'), 'help:content:contact');
    }

    await ctx.reply(content, {
      reply_markup: backKb,
      parse_mode: 'Markdown',
    });
  }));
}
