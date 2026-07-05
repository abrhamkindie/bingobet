/**
 * Support ticket submission handler.
 *
 * Walks the user through an interactive flow:
 *   category → description → screenshot (optional) → confirm → saved
 *
 * @module bot/handlers/support
 */

import { InlineKeyboard, Keyboard } from 'grammy';
import * as supportRepo from '../../db/repositories/supportTickets.js';
import { allTranslations } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { logger } from '../../utils/logger.js';
import { Flow, clearFlowSession, setFlowSession, getFlowSession } from '../utils/session.js';
import { botAsyncHandler } from '../utils/botError.js';
import { miniAppKeyboard, cancelKeyboard } from '../keyboards.js';
import { showHelpMenu } from '../help.js';
import { predictCategoryKey } from '../../services/classifier.js';
import { trackBotEvent } from '../analytics.js';

// ── Step constants ─────────────────────────────────────────────────────────

const TicketStep = {
  CATEGORY: 'ticket_category',
  DESCRIPTION: 'ticket_description',
  SCREENSHOT: 'ticket_screenshot',
  CONFIRM: 'ticket_confirm',
};

// ── Category labels & callback data ────────────────────────────────────────

const CATEGORIES = [
  { key: 'payment', i18n: 'support.category_payment' },
  { key: 'booking', i18n: 'support.category_booking' },
  { key: 'host',    i18n: 'support.category_host' },
  { key: 'feature', i18n: 'support.category_feature' },
  { key: 'other',   i18n: 'support.category_other' },
];

// ── Keyboard builders ──────────────────────────────────────────────────────

function categoryKeyboard(t) {
  const kb = new InlineKeyboard();
  for (const cat of CATEGORIES) {
    kb.text(t(cat.i18n), `ticket:cat:${cat.key}`).row();
  }
  kb.text(t('common.cancel'), 'ticket:cancel');
  return kb;
}

function confirmKeyboard(t) {
  return new InlineKeyboard()
    .text(t('support.btn_submit'), 'ticket:submit')
    .row()
    .text(t('support.btn_edit'), 'ticket:edit');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function categoryLabel(t, key) {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? t(found.i18n) : key;
}

// ── Ticket submission flow ─────────────────────────────────────────────────

/**
 * Start the support ticket submission flow.
 * Called from the help menu or /support command.
 *
 * @param {import('grammy').Context} ctx
 */
export async function startTicketFlow(ctx) {
  setFlowSession(ctx.from.id, { flow: Flow.SUPPORT_TICKET, step: TicketStep.CATEGORY, draft: {} });
  await trackBotEvent(ctx, 'support_ticket_started');
  await ctx.reply(ctx.t('support.choose_category'), {
    reply_markup: categoryKeyboard(ctx.t),
  });
}

// ── Middleware: intercept text/photo messages mid-flow ─────────────────────

export function supportFlowMiddleware() {
  return async (ctx, next) => {
    const s = getFlowSession(ctx.from?.id);
    if (!s || s.flow !== Flow.SUPPORT_TICKET) return next();
    if (!ctx.message) return next();

    // Cancel from any step
    const text = ctx.message.text;
    if (text && (allTranslations('common.cancel').includes(text) || text === '/cancel')) {
      clearFlowSession(ctx.from.id);
      await trackBotEvent(ctx, 'support_ticket_cancelled', { stage: s.step });
      await ctx.reply(ctx.t('support.cancelled'), {
        reply_markup:
          ctx.dbUser?.role === 'host' ? miniAppKeyboard() : miniAppKeyboard(),
      });
      return;
    }

    switch (s.step) {
      case TicketStep.DESCRIPTION:
        return handleDescription(ctx, s);
      case TicketStep.SCREENSHOT:
        return handleScreenshot(ctx, s);
      default:
        return next();
    }
  };
}

async function handleDescription(ctx, s) {
  const t = ctx.t;
  const desc = ctx.message.text?.trim();

  if (!desc || desc.length < 10) {
    return ctx.reply(t('support.ask_description'));
  }
  if (desc.length > 1000) {
    return ctx.reply(t('support.err_too_long'));
  }

  s.draft.description = desc;
  s.step = TicketStep.SCREENSHOT;
  setFlowSession(ctx.from.id, s);
  await trackBotEvent(ctx, 'support_ticket_description_added', { category: s.draft.category });

  await ctx.reply(t('support.ask_screenshot'), {
    reply_markup: new Keyboard()
      .text(t('support.skip_screenshot'))
      .row()
      .text(t('common.cancel'))
      .resized()
      .oneTime(),
  });
}

async function handleScreenshot(ctx, s) {
  const t = ctx.t;
  const msg = ctx.message;
  const text = msg.text?.trim();

  // Skip screenshot
  if (text && allTranslations('support.skip_screenshot').includes(text)) {
    s.draft.screenshotFileId = null;
    s.step = TicketStep.CONFIRM;
    setFlowSession(ctx.from.id, s);
    await trackBotEvent(ctx, 'support_ticket_screenshot_skipped', { category: s.draft.category });
    return showConfirm(ctx, s);
  }

  // Photo received
  if (msg.photo && msg.photo.length) {
    s.draft.screenshotFileId = msg.photo[msg.photo.length - 1].file_id;
    s.step = TicketStep.CONFIRM;
    setFlowSession(ctx.from.id, s);
    await trackBotEvent(ctx, 'support_ticket_screenshot_added', { category: s.draft.category });
    return showConfirm(ctx, s);
  }

  // Cancel
  if (text && (allTranslations('common.cancel').includes(text) || text === '/cancel')) {
    clearFlowSession(ctx.from.id);
    await trackBotEvent(ctx, 'support_ticket_cancelled', { stage: s.step });
    return ctx.reply(t('support.cancelled'), {
      reply_markup:
        ctx.dbUser?.role === 'host' ? miniAppKeyboard() : miniAppKeyboard(),
    });
  }

  // Invalid input
  return ctx.reply(t('support.ask_screenshot'));
}

async function showConfirm(ctx, s) {
  const t = ctx.t;
  const catLabel = categoryLabel(t, s.draft.category);
  const summary =
    `${t('support.confirm_title')}\n\n` +
    t('support.confirm_body', { category: catLabel, description: s.draft.description }) +
    (s.draft.screenshotFileId ? t('support.with_screenshot') : '') +
    `\n\n${t('support.confirm_prompt')}`;

  await ctx.reply(summary, {
    reply_markup: confirmKeyboard(t),
    parse_mode: 'Markdown',
  });
}

async function submitTicket(ctx, s) {
  const t = ctx.t;
  const draft = s.draft;

  try {
    // Run AI auto-classification on the description
    const autoCategory = predictCategoryKey(draft.description);

    const ticket = await supportRepo.create({
      userId: ctx.dbUser.id,
      category: draft.category,
      description: draft.description,
      screenshotFileId: draft.screenshotFileId,
      autoCategory,
    });

    clearFlowSession(ctx.from.id);
    await trackBotEvent(ctx, 'support_ticket_created', {
      ticket_id: ticket.id,
      category: draft.category,
      auto_category: autoCategory,
      has_screenshot: Boolean(draft.screenshotFileId),
    });

    const catLabel = categoryLabel(t, draft.category);

    // Log if AI detected a different category
    if (autoCategory !== draft.category) {
      logger.info('AI auto-categorisation', {
        ticketId: ticket.id,
        userCategory: draft.category,
        autoCategory,
        description: draft.description.slice(0, 100),
      });
    }

    await ctx.reply(
      `${t('support.submitted_title')}\n\n` +
      t('support.submitted_body', { id: ticket.id, category: catLabel }),
      {
        parse_mode: 'Markdown',
        reply_markup:
          ctx.dbUser?.role === 'host' ? miniAppKeyboard() : miniAppKeyboard(),
      }
    );

    logger.info('Support ticket created', {
      ticketId: ticket.id,
      userId: ctx.dbUser.id,
      category: draft.category,
    });
  } catch (err) {
    logger.error('Failed to create support ticket', { error: err.message });
    await ctx.reply(t('common.error_generic'), {
      reply_markup:
        ctx.dbUser?.role === 'host' ? miniAppKeyboard() : miniAppKeyboard(),
    });
  }
}

// ── Show user's existing tickets ──────────────────────────────────────────

export async function showMyTickets(ctx) {
  const t = ctx.t;
  try {
    const tickets = await supportRepo.listByUser(ctx.dbUser.id, 10);
    if (!tickets.length) {
      return ctx.reply(t('support.my_tickets_empty'));
    }
    const lines = tickets.map((tk) =>
      t('support.ticket_line', {
        id: tk.id,
        category: categoryLabel(t, tk.category),
        status: t(`support.status_${tk.status}`),
        date: formatDateTime(tk.created_at, { dateOnly: true }),
      })
    );
    await ctx.reply(`*${t('support.my_tickets')}*\n\n${lines.join('\n\n')}`, {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.error('Failed to list tickets', { error: err.message });
    await ctx.reply(t('common.error_generic'));
  }
}

// ── Register callbacks & commands ─────────────────────────────────────────

export function registerSupport(bot) {
  // /support command — shortcut to submit a ticket
  bot.command('support', botAsyncHandler(async (ctx) => {
    await startTicketFlow(ctx);
  }));

  // /tickets command — view my existing tickets
  bot.command('tickets', botAsyncHandler(async (ctx) => {
    await trackBotEvent(ctx, 'support_tickets_viewed');
    await showMyTickets(ctx);
  }));

  // Start ticket flow from help menu or other entry points
  bot.callbackQuery(/^ticket:start/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await startTicketFlow(ctx);
  }));

  // Category selection
  bot.callbackQuery(/^ticket:cat:(\w+)$/, botAsyncHandler(async (ctx) => {
    const category = ctx.match[1];
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.SUPPORT_TICKET) {
      await ctx.answerCallbackQuery({ text: ctx.t('common.error_generic') });
      return;
    }
    await ctx.answerCallbackQuery();

    s.draft.category = category;
    s.step = TicketStep.DESCRIPTION;
    setFlowSession(ctx.from.id, s);
    await trackBotEvent(ctx, 'support_ticket_category_selected', { category });

    await ctx.reply(ctx.t('support.ask_description'), {
      reply_markup: cancelKeyboard(ctx.t),
    });
  }));

  // Confirm & submit
  bot.callbackQuery('ticket:submit', botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.SUPPORT_TICKET) return;
    await submitTicket(ctx, s);
  }));

  // Edit — go back to description
  bot.callbackQuery('ticket:edit', botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.SUPPORT_TICKET) return;

    s.step = TicketStep.DESCRIPTION;
    setFlowSession(ctx.from.id, s);
    await ctx.reply(ctx.t('support.ask_description'), {
      reply_markup: cancelKeyboard(ctx.t),
    });
  }));

  // Cancel ticket flow
  bot.callbackQuery('ticket:cancel', botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    clearFlowSession(ctx.from.id);
    await trackBotEvent(ctx, 'support_ticket_cancelled', { stage: 'callback' });
    await ctx.reply(ctx.t('support.cancelled'), {
      reply_markup:
        ctx.dbUser?.role === 'host' ? miniAppKeyboard() : miniAppKeyboard(),
    });
  }));
}
