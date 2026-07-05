/**
 * Check-in handlers — spot check-in and completion.
 *
 * @module bot/handlers/checkin
 */

import { InlineKeyboard } from 'grammy';
import { checkIn, checkInByConfirmationCode, checkInByBookingId, complete, CheckinError } from '../../services/checkinService.js';
import { triggerRatingPrompt } from './rating.js';
import { getTranslator, allTranslations } from '../../i18n/index.js';
import { formatDateTime, formatMoney, currency } from '../../utils/format.js';
import { logger } from '../../utils/logger.js';
import { BotError, BotErrorCode, botAsyncHandler, translateError } from '../utils/botError.js';
import { trackBotEvent } from '../analytics.js';

// Shared helper: reply with check-in success and the "Mark Complete" button,
// and notify the driver.
async function checkinSuccessReply(ctx, booking) {
  const kb = new InlineKeyboard().text(ctx.t('checkin.complete_button'), `checkin:complete:${booking.id}`);
  await ctx.reply(
    ctx.t('checkin.success_owner', {
      driver: booking.driver_name || '—',
      address: booking.address || '—',
      start: formatDateTime(booking.start_time),
      end: formatDateTime(booking.end_time),
      total: formatMoney(booking.total_price),
      currency,
    }),
    { reply_markup: kb }
  );

  // Notify the driver in their own language (best-effort).
  try {
    const dt = getTranslator(booking.driver_language_pref || 'en');
    await ctx.api.sendMessage(
      Number(booking.driver_telegram_id),
      dt('checkin.driver_notified', { address: booking.address || '—' })
    );
  } catch (err) {
    logger.warn('driver notify failed', { error: err.message });
  }
}

// Shared helper: handle a CheckinError and reply with a localized message.
function checkinErrorReply(ctx, err) {
  if (err instanceof CheckinError) return ctx.reply(translateError(ctx.t, `CHECKIN_${err.code}`));
  logger.error('checkin failed', { error: err.message });
  return ctx.reply(ctx.t('common.error_generic'));
}

// Check in by confirmation code — called from the /checkin command.
export async function checkInByCode(ctx, confirmationCode) {
  try {
    const { booking } = await checkInByConfirmationCode({
      scannerTelegramId: ctx.from.id,
      scannerRole: ctx.dbUser?.role,
      confirmationCode,
    });
    await trackBotEvent(ctx, 'checkin_success', { booking_id: booking.id, method: 'code' });
    return checkinSuccessReply(ctx, booking);
  } catch (err) {
    return checkinErrorReply(ctx, err);
  }
}

// Check in by booking ID — called from the host's booking list button.
export async function checkInByBooking(ctx, bookingId) {
  try {
    const { booking } = await checkInByBookingId({
      scannerTelegramId: ctx.from.id,
      scannerRole: ctx.dbUser?.role,
      bookingId,
    });
    await trackBotEvent(ctx, 'checkin_success', { booking_id: booking.id, method: 'host_button' });
    return checkinSuccessReply(ctx, booking);
  } catch (err) {
    return checkinErrorReply(ctx, err);
  }
}

// Entry from start.js when the /start payload is checkin_<token>.
export async function handleCheckin(ctx, token) {
  try {
    const { booking } = await checkIn({
      scannerTelegramId: ctx.from.id,
      scannerRole: ctx.dbUser?.role,
      token,
    });
    await trackBotEvent(ctx, 'checkin_success', { booking_id: booking.id, method: 'qr_token' });
    return checkinSuccessReply(ctx, booking);
  } catch (err) {
    return checkinErrorReply(ctx, err);
  }
}

// Shared handler: send the QR scanner Mini App button.
async function sendQrScanner(ctx) {
  const { config } = await import('../../config/index.js');
  const baseUrl = config.publicUrl || `https://t.me/${config.botUsername}`;
  const scanUrl = `${baseUrl.replace(/\/+$/, '')}/miniapp/scan.html`;
  await trackBotEvent(ctx, 'qr_scanner_opened');
  await ctx.reply(ctx.t('checkin.scan_qr_instructions'), {
    reply_markup: new InlineKeyboard().webApp(
      ctx.t('checkin.scan_qr'),
      scanUrl
    ),
  });
}

export function registerCheckin(bot) {
  // /scanqr — send the QR scanner Mini App button.
  bot.command('scanqr', botAsyncHandler(sendQrScanner));

  // Host menu button — same as /scanqr.
  bot.hears(allTranslations('menu.scan_qr'), botAsyncHandler(sendQrScanner));

  // Complete an active booking.
  bot.callbackQuery(/^checkin:complete:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const bookingId = Number(ctx.match[1]);

    await complete({
      bookingId,
      scannerTelegramId: ctx.from.id,
      scannerRole: ctx.dbUser?.role,
    });
    await trackBotEvent(ctx, 'booking_completed', { booking_id: bookingId });
    await ctx.reply(ctx.t('checkin.completed_owner'));

    // Trigger rating prompt to driver
    await triggerRatingPrompt(ctx, bookingId);
  }));

  // Host check-in button from the booking list.
  bot.callbackQuery(/^host:checkin:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const bookingId = Number(ctx.match[1]);
    await checkInByBooking(ctx, bookingId);
  }));

  // Process QR code scanned via the Mini App scanner → web_app_data.
  bot.on('message:web_app_data', botAsyncHandler(async (ctx) => {
    try {
      const data = JSON.parse(ctx.message.web_app_data.data);
      if (data.type === 'checkin' && data.token) {
        await trackBotEvent(ctx, 'qr_scan_submitted', { type: 'token' });
        await handleCheckin(ctx, data.token);
      } else if (data.type === 'checkin_code' && data.code) {
        await trackBotEvent(ctx, 'qr_scan_submitted', { type: 'code' });
        await checkInByCode(ctx, data.code);
      } else {
        await ctx.reply(ctx.t('checkin.err_not_found'));
      }
    } catch {
      await ctx.reply(ctx.t('checkin.err_not_found'));
    }
  }));
}
