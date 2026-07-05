import * as bookingsRepo from '../db/repositories/bookings.js';
import * as hostRepo from '../db/repositories/host.js';
import { checkinQrPng } from '../utils/qr.js';
import { formatMoney, currency, formatDateTime, mdEscape } from '../utils/format.js';
import { getTranslator } from '../i18n/index.js';
import { logger } from '../utils/logger.js';
import { InputFile } from 'grammy';

// ── Support Ticket Notifications ─────────────────────────────────────────

/**
 * Notify a user on Telegram when an admin replies to their support ticket.
 *
 * The `ticket` object must include `user_telegram_id` and `user_language_pref`
 * (both are returned by {@link module:db/repositories/admin/tickets.getById}).
 *
 * Notification is best-effort — failures are logged but never thrown.
 *
 * @param {import('grammy').Bot} bot - The Telegram bot instance
 * @param {Object} ticket - Full ticket object (must include user_telegram_id, user_language_pref)
 * @param {Object} reply - The reply that was just added
 * @param {string} reply.message - The reply text
 */
export async function sendTicketReplyNotification(bot, ticket, reply) {
  try {
    const t = getTranslator(ticket.user_language_pref || 'en');
    const text = t('notification.ticket_reply', {
      ticketId: ticket.id,
      message: reply.message,
    });

    await bot.api.sendMessage(Number(ticket.user_telegram_id), text, {
      parse_mode: 'Markdown',
    });

    logger.info('Ticket reply notification sent', {
      ticketId: ticket.id,
      userId: ticket.user_id,
      telegramId: ticket.user_telegram_id,
    });
  } catch (err) {
    // User may have never started the bot or blocked it; don't fail the reply.
    logger.warn('Failed to send ticket reply notification', {
      ticketId: ticket.id,
      userId: ticket.user_id,
      error: err.message,
    });
  }
}

// Send booking start reminder to driver (30 minutes before).
export async function sendBookingStartReminder(bot, booking) {
  try {
    const t = getTranslator(booking.driver_language_pref || 'en');
    const text = t('notification.booking_start_reminder', {
      address: booking.address || '—',
      start_time: formatDateTime(booking.start_time),
      code: booking.confirmation_code,
    });

    await bot.api.sendMessage(Number(booking.driver_telegram_id), text);
    logger.info('Start reminder sent', { bookingId: booking.id, driverId: booking.driver_id });
  } catch (err) {
    logger.error('Failed to send start reminder', {
      bookingId: booking.id,
      error: err.message,
    });
  }
}

// Send payment expiry warning to driver.
export async function sendPaymentExpiryWarning(bot, booking) {
  try {
    const t = getTranslator(booking.driver_language_pref || 'en');
    const text = t('notification.payment_expiry_warning', {
      code: booking.confirmation_code,
      amount: formatMoney(booking.total_price),
      currency,
    });

    await bot.api.sendMessage(Number(booking.driver_telegram_id), text);
    logger.info('Payment warning sent', { bookingId: booking.id, driverId: booking.driver_id });
  } catch (err) {
    logger.error('Failed to send payment warning', {
      bookingId: booking.id,
      error: err.message,
    });
  }
}

// Send check-in prompt with QR code to driver.
export async function sendCheckinPrompt(bot, booking) {
  try {
    const t = getTranslator(booking.driver_language_pref || 'en');
    const text = t('notification.checkin_prompt', {
      address: booking.address || '—',
    });

    // Generate QR code
    const qrBuffer = await checkinQrPng(booking.checkin_token);
    const qrFile = new InputFile(qrBuffer, 'checkin.png');

    await bot.api.sendPhoto(Number(booking.driver_telegram_id), qrFile, {
      caption: text,
    });

    logger.info('Check-in prompt sent', { bookingId: booking.id, driverId: booking.driver_id });
  } catch (err) {
    logger.error('Failed to send check-in prompt', {
      bookingId: booking.id,
      error: err.message,
    });
  }
}

// Send upcoming booking alert to host (1 hour before).
export async function sendHostUpcomingBooking(bot, booking) {
  try {
    const recipients = await hostRepo.listBookingNotificationRecipients(booking.id);
    if (!recipients.length && booking.owner_telegram_id) {
      recipients.push({
        id: booking.owner_id,
        telegram_id: booking.owner_telegram_id,
        language_pref: booking.owner_language_pref || 'en',
        access_role: 'owner',
      });
    }

    await Promise.allSettled(recipients.map(async (recipient) => {
      const t = getTranslator(recipient.language_pref || 'en');
      const text = t('notification.host_upcoming_booking', {
        address: booking.address || '—',
        driver_name: booking.driver_name || '—',
        start_time: formatDateTime(booking.start_time),
        end_time: formatDateTime(booking.end_time),
        code: booking.confirmation_code,
      });

      await bot.api.sendMessage(Number(recipient.telegram_id), text);
    }));

    logger.info('Host alert sent', {
      bookingId: booking.id,
      hostId: booking.owner_id,
      recipients: recipients.length,
    });
  } catch (err) {
    logger.error('Failed to send host alert', {
      bookingId: booking.id,
      error: err.message,
    });
  }
}

// Notify spot owner and assigned booking managers when payment confirms.
export async function sendHostNewBookingNotification(bot, booking) {
  if (!bot?.api?.sendMessage) return;

  const claimed = await bookingsRepo.claimNotification(booking.id, 'host_new_booking');
  if (!claimed) {
    logger.info('Host new booking notification already sent', { bookingId: booking.id });
    return;
  }

  const recipients = await hostRepo.listBookingNotificationRecipients(booking.id);
  if (!recipients.length && booking.owner_telegram_id) {
    recipients.push({
      id: booking.owner_id,
      telegram_id: booking.owner_telegram_id,
      language_pref: booking.owner_language_pref || 'en',
      access_role: 'owner',
    });
  }

  if (!recipients.length) {
    logger.warn('No host recipients for new booking notification', { bookingId: booking.id });
    return;
  }

  const results = await Promise.allSettled(recipients.map(async (recipient) => {
    const t = getTranslator(recipient.language_pref || booking.owner_language_pref || 'en');
    const text = t('notification.host_new_booking', {
      address: mdEscape(booking.address || '—'),
      driver_name: mdEscape(booking.driver_name || '—'),
      start_time: formatDateTime(booking.start_time),
      end_time: formatDateTime(booking.end_time),
      code: mdEscape(booking.confirmation_code),
      total: formatMoney(booking.total_price),
      currency,
    });

    await bot.api.sendMessage(Number(recipient.telegram_id), text, { parse_mode: 'Markdown' });
  }));

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length) {
    logger.warn('Some host new booking notifications failed', {
      bookingId: booking.id,
      failed: failed.length,
      total: recipients.length,
      error: failed[0]?.reason?.message,
    });
  }

  logger.info('Host new booking notification sent', {
    bookingId: booking.id,
    recipients: recipients.length - failed.length,
  });
}

// Compatibility wrapper for older bot payment flow call sites.
export async function notifyHostPayment(botOrCtx, booking) {
  const bot = botOrCtx?.api?.sendMessage ? { api: botOrCtx.api } : botOrCtx;
  return sendHostNewBookingNotification(bot, booking);
}

// Cancel expired unpaid booking and notify both parties.
export async function cancelExpiredUnpaidBooking(bot, booking) {
  try {
    // Cancel the booking
    await bookingsRepo.updateStatus(booking.id, 'cancelled', {
      cancelledReason: 'payment_timeout',
    });

    // Notify driver
    const dt = getTranslator(booking.driver_language_pref || 'en');
    const driverText = dt('notification.booking_cancelled_timeout', {
      code: booking.confirmation_code,
    });

    try {
      await bot.api.sendMessage(Number(booking.driver_telegram_id), driverText);
    } catch (err) {
      logger.error('Failed to notify driver of cancellation', {
        bookingId: booking.id,
        error: err.message,
      });
    }

    // Notify host
    const recipients = await hostRepo.listBookingNotificationRecipients(booking.id);
    if (!recipients.length && booking.owner_telegram_id) {
      recipients.push({
        id: booking.owner_id,
        telegram_id: booking.owner_telegram_id,
        language_pref: booking.owner_language_pref || 'en',
      });
    }

    await Promise.allSettled(recipients.map(async (recipient) => {
      const ht = getTranslator(recipient.language_pref || 'en');
      const hostText = ht('notification.booking_cancelled_host', {
        code: booking.confirmation_code,
        address: booking.address || '—',
      });
      await bot.api.sendMessage(Number(recipient.telegram_id), hostText);
    }));

    logger.info('Booking auto-cancelled', {
      bookingId: booking.id,
      reason: 'payment_timeout',
    });
  } catch (err) {
    logger.error('Failed to cancel expired booking', {
      bookingId: booking.id,
      error: err.message,
    });
  }
}
