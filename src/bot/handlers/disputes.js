/**
 * Dispute resolution handlers — drivers can raise disputes about bookings.
 *
 * @module bot/handlers/disputes
 */

import { InlineKeyboard } from 'grammy';
import * as disputesRepo from '../../db/repositories/disputes.js';
import { allTranslations } from '../../i18n/index.js';
import { botAsyncHandler } from '../utils/botError.js';
import { Flow, clearFlowSession, getFlowSession, setFlowSession } from '../utils/session.js';
import { cancelKeyboard } from '../keyboards.js';
import { formatDateTime, formatMoney, currency } from '../../utils/format.js';
import { trackBotEvent } from '../analytics.js';

const DisputeStep = {
  SELECT_BOOKING: 'select_booking',
  SELECT_REASON: 'select_reason',
  CUSTOM_REASON: 'custom_reason',
};

export function registerDisputes(bot) {
  // /disputes — list user's disputes
  bot.command('disputes', botAsyncHandler(async (ctx) => {
    await showDisputeList(ctx);
  }));

  // Start dispute flow
  bot.callbackQuery(/^dispute:start$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const bookings = await disputesRepo.getDisputableBookings(ctx.dbUser.id);
    
    if (bookings.length === 0) {
      return ctx.reply(ctx.t('disputes.no_disputable_bookings'));
    }

    setFlowSession(ctx.from.id, { flow: Flow.DISPUTE, step: DisputeStep.SELECT_BOOKING });
    await showBookingSelection(ctx, bookings);
  }));

  // Select a booking to dispute
  bot.callbackQuery(/^dispute:booking:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.DISPUTE) return;

    const bookingId = Number(ctx.match[1]);
    s.bookingId = bookingId;
    s.step = DisputeStep.SELECT_REASON;
    setFlowSession(ctx.from.id, s);

    await showReasonSelection(ctx);
  }));

  // Select a predefined reason
  bot.callbackQuery(/^dispute:reason:(.+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.DISPUTE || s.step !== DisputeStep.SELECT_REASON) return;

    const reasonKey = ctx.match[1];
    
    if (reasonKey === 'other') {
      s.step = DisputeStep.CUSTOM_REASON;
      setFlowSession(ctx.from.id, s);
      await ctx.reply(ctx.t('disputes.ask_custom_reason'), { reply_markup: cancelKeyboard(ctx.t) });
      return;
    }

    s.reason = ctx.t(`disputes.reasons.${reasonKey}`);
    await createDisputeAndConfirm(ctx, s);
  }));

  // Handle custom reason text
  bot.on('message:text', botAsyncHandler(async (ctx, next) => {
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.DISPUTE || s.step !== DisputeStep.CUSTOM_REASON) return next();

    const text = ctx.message.text?.trim();
    if (!text) return next();

    // Cancel
    if (allTranslations('common.cancel').includes(text)) {
      clearFlowSession(ctx.from.id);
      return ctx.reply(ctx.t('disputes.cancelled'));
    }

    if (text.length < 10) {
      return ctx.reply(ctx.t('disputes.reason_too_short'));
    }

    s.reason = text;
    await createDisputeAndConfirm(ctx, s);
  }));

  // View dispute details
  bot.callbackQuery(/^dispute:view:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const dispute = await disputesRepo.getById(id);
    
    if (!dispute || String(dispute.raised_by) !== String(ctx.dbUser.id)) {
      return ctx.reply(ctx.t('common.error_generic'));
    }

    const t = ctx.t;
    let text = `*${t('disputes.detail_title')}* #${dispute.id}\n\n`;
    text += `📍 ${t('disputes.detail_address')}: ${dispute.address}\n`;
    text += `🔖 ${t('disputes.detail_code')}: ${dispute.confirmation_code}\n`;
    text += `📅 ${t('disputes.detail_date')}: ${formatDateTime(dispute.start_time)}\n`;
    text += `💰 ${t('disputes.detail_amount')}: ${formatMoney(dispute.total_price)} ${currency}\n\n`;
    text += `*${t('disputes.detail_reason')}:*\n${dispute.reason}\n\n`;
    text += `*${t('disputes.detail_status')}:* ${t(`disputes.status_${dispute.status}`)}`;
    
    if (dispute.resolution) {
      text += `\n\n*${t('disputes.detail_resolution')}:*\n${dispute.resolution}`;
    }

    await ctx.reply(text, { parse_mode: 'Markdown' });
  }));
}

async function showDisputeList(ctx) {
  const disputes = await disputesRepo.listByUser(ctx.dbUser.id);
  const t = ctx.t;

  if (disputes.length === 0) {
    const kb = new InlineKeyboard().text(t('disputes.raise_new'), 'dispute:start');
    return ctx.reply(t('disputes.empty'), { reply_markup: kb });
  }

  let text = `*${t('disputes.list_title')}*\n\n`;
  const kb = new InlineKeyboard();

  for (const d of disputes) {
    const statusEmoji = d.status === 'open' ? '🟡' : d.status === 'resolved' ? '🟢' : '🔴';
    text += `${statusEmoji} #${d.id} - ${d.address}\n`;
    text += `   ${t('disputes.status_' + d.status)} - ${formatDateTime(d.created_at)}\n\n`;
    kb.text(`#${d.id}`, `dispute:view:${d.id}`).row();
  }

  kb.text(t('disputes.raise_new'), 'dispute:start');

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

async function showBookingSelection(ctx, bookings) {
  const t = ctx.t;
  let text = `*${t('disputes.select_booking')}*\n\n`;
  const kb = new InlineKeyboard();

  for (const b of bookings) {
    const label = `${b.confirmation_code} - ${b.address.slice(0, 30)}`;
    kb.text(label, `dispute:booking:${b.id}`).row();
  }

  kb.text(t('common.cancel'), 'dispute:cancel');

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

async function showReasonSelection(ctx) {
  const t = ctx.t;
  const kb = new InlineKeyboard()
    .text(t('disputes.reasons.spot_not_available'), 'dispute:reason:spot_not_available').row()
    .text(t('disputes.reasons.spot_different'), 'dispute:reason:spot_different').row()
    .text(t('disputes.reasons.host_no_show'), 'dispute:reason:host_no_show').row()
    .text(t('disputes.reasons.safety_issue'), 'dispute:reason:safety_issue').row()
    .text(t('disputes.reasons.other'), 'dispute:reason:other').row()
    .text(t('common.cancel'), 'dispute:cancel');

  await ctx.reply(t('disputes.select_reason'), { reply_markup: kb });
}

async function createDisputeAndConfirm(ctx, session) {
  try {
    const dispute = await disputesRepo.createDispute({
      bookingId: session.bookingId,
      raisedBy: ctx.dbUser.id,
      reason: session.reason,
    });

    clearFlowSession(ctx.from.id);
    await trackBotEvent(ctx, 'dispute_raised', { dispute_id: dispute.id, booking_id: session.bookingId });

    const t = ctx.t;
    const text = `✅ *${t('disputes.submitted_title')}*\n\n` +
      `${t('disputes.submitted_body', { id: dispute.id })}\n\n` +
      `_${t('disputes.submitted_note')}_`;

    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (err) {
    if (err.message === 'DISPUTE_ALREADY_EXISTS') {
      clearFlowSession(ctx.from.id);
      return ctx.reply(ctx.t('disputes.already_exists'));
    }
    throw err;
  }
}
