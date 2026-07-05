import * as paymentsRepo from '../db/repositories/payments.js';
import * as bookingsRepo from '../db/repositories/bookings.js';
import { query } from '../db/index.js';
import { initializePayment, verifyPayment } from './chapaService.js';
import { confirmPayment } from './bookingService.js';
import { calcSplit } from './pricing.js';
import { checkinQrPng } from '../utils/qr.js';
import { checkinLink } from '../utils/deeplink.js';
import { formatMoney, currency, formatDateTime, mdEscape } from '../utils/format.js';
import { InputFile } from 'grammy';
import { getTranslator } from '../i18n/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { sendHostNewBookingNotification } from './notificationService.js';

const SUCCESS_GATEWAY_STATUSES = new Set(['success', 'paid', 'completed']);
const FAILED_GATEWAY_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'expired']);

function normalizeGatewayStatus(status) {
  return String(status || '').trim().toLowerCase();
}

// Initiate payment for a booking (Chapa or manual).
// Returns: { payment, checkoutUrl? }
export async function initiatePayment({ bookingId, method = 'chapa', ctx, returnUrl, callbackUrl }) {
  const existingPayment = await paymentsRepo.getByBookingId(bookingId);

  const booking = await bookingsRepo.getByIdWithParties(bookingId);
  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  if (booking.payment_status !== 'unpaid') {
    throw new Error('BOOKING_ALREADY_PAID');
  }

  if (existingPayment) {
    if (existingPayment.status === 'paid') {
      throw new Error('BOOKING_ALREADY_PAID');
    }

    if (existingPayment.status === 'pending' && existingPayment.method === 'chapa' && existingPayment.checkout_url) {
      return { payment: existingPayment, checkoutUrl: existingPayment.checkout_url, reused: true };
    }

    if (['pending', 'awaiting_review'].includes(existingPayment.status)) {
      throw new Error('PAYMENT_ALREADY_EXISTS');
    }
  }

  // Calculate split (commission + host payout)
  const split = await calcSplit(booking.total_price);

  let payment;
  let checkoutUrl;

  if (method === 'chapa') {
    // Initialize Chapa payment
    const chapaResult = await initializePayment({
      amount: booking.total_price,
      currency: 'ETB',
      bookingId,
      customerEmail: ctx?.from?.username ? `${ctx.from.username}@gmail.com` : undefined,
      customerPhone: ctx?.dbUser?.phone,
      callbackUrl: callbackUrl || `${config.publicUrl}/api/payments/chapa/webhook`,
      returnUrl: returnUrl || `https://t.me/${config.botUsername}`,
    });

    // Create payment record
    payment = await paymentsRepo.createPayment({
      bookingId,
      method: 'chapa',
      amount: split.total,
      commissionAmount: split.commission,
      hostPayoutAmount: split.hostPayout,
      status: 'pending',
      reference: chapaResult.tx_ref,
      checkoutUrl: chapaResult.checkout_url,
    });

    checkoutUrl = chapaResult.checkout_url;
  } else if (method === 'manual') {
    // Manual transfer - create payment in awaiting_review status
    payment = await paymentsRepo.createPayment({
      bookingId,
      method: 'manual',
      amount: split.total,
      commissionAmount: split.commission,
      hostPayoutAmount: split.hostPayout,
      status: 'awaiting_review',
      reference: `manual_${booking.confirmation_code}`,
    });
  } else {
    throw new Error('INVALID_PAYMENT_METHOD');
  }

  return { payment, checkoutUrl };
}

// Refresh a Chapa payment from the gateway without assuming checkout is complete.
// Returns: { booking, payment, paid, failed, gatewayStatus }
export async function checkChapaPayment(txRef, { cancelOnFailure = false } = {}) {
  const payment = await paymentsRepo.getByReference(txRef);
  if (!payment) {
    throw new Error('PAYMENT_NOT_FOUND');
  }

  if (payment.status === 'paid') {
    const booking = await bookingsRepo.getByIdWithParties(payment.booking_id);
    return { booking, payment, paid: true, failed: false, gatewayStatus: 'paid' };
  }

  const verification = await verifyPayment(txRef);
  const gatewayStatus = normalizeGatewayStatus(verification.status);

  if (SUCCESS_GATEWAY_STATUSES.has(gatewayStatus)) {
    const updatedPayment = await paymentsRepo.updateStatus(payment.id, 'paid', verification.data);
    if (!updatedPayment) {
      const booking = await bookingsRepo.getByIdWithParties(payment.booking_id);
      return {
        booking,
        payment: await paymentsRepo.getByBookingId(payment.booking_id),
        paid: true,
        failed: false,
        gatewayStatus,
      };
    }

    const booking = await confirmPayment(payment.booking_id);
    await notifyHostOfConfirmedBooking(booking);
    return { booking, payment: updatedPayment, paid: true, failed: false, gatewayStatus };
  }

  if (FAILED_GATEWAY_STATUSES.has(gatewayStatus)) {
    const updatedPayment = await paymentsRepo.updateStatus(payment.id, 'failed', verification.data) || payment;
    if (cancelOnFailure) {
      await bookingsRepo.updateStatus(payment.booking_id, 'cancelled', {
        cancelledReason: 'Payment failed',
      });
    }

    const booking = await bookingsRepo.getByIdWithParties(payment.booking_id);
    return { booking, payment: updatedPayment, paid: false, failed: true, gatewayStatus };
  }

  const booking = await bookingsRepo.getByIdWithParties(payment.booking_id);
  return { booking, payment, paid: false, failed: false, gatewayStatus: gatewayStatus || 'pending' };
}

// Process successful Chapa payment (called from webhook or manual verification).
// Returns: { booking, payment }
export async function confirmChapaPayment(txRef) {
  const result = await checkChapaPayment(txRef, { cancelOnFailure: true });

  if (result.paid) {
    return { booking: result.booking, payment: result.payment };
  }

  if (result.failed) {
    throw new Error('PAYMENT_FAILED');
  }

  throw new Error('PAYMENT_PENDING');
}

// Process manual transfer payment (auto-accept mode).
// Returns: { booking, payment }
export async function processManualPayment({ bookingId, screenshotFileId, reference }) {
  const payment = await paymentsRepo.getByBookingId(bookingId);
  if (!payment) {
    throw new Error('PAYMENT_NOT_FOUND');
  }

  if (payment.status === 'paid') {
    // Already processed
    const booking = await bookingsRepo.getByIdWithParties(bookingId);
    return { booking, payment };
  }

  // Update payment with screenshot and mark as paid (auto-accept)
  const raw = { screenshot_file_id: screenshotFileId, reference };
  const updatedPayment = await paymentsRepo.updateStatus(payment.id, 'paid', raw);

  if (!updatedPayment) {
    throw new Error('PAYMENT_ALREADY_PROCESSED');
  }

  // Also update the screenshot_file_id field
  await query(
    'UPDATE payments SET screenshot_file_id = $1 WHERE id = $2',
    [screenshotFileId, payment.id]
  );

  // Update booking payment status and confirm
  const booking = await confirmPayment(bookingId);
  await notifyHostOfConfirmedBooking(booking);

  return { booking, payment: updatedPayment };
}

// Send payment receipt with QR code to user.
export async function sendPaymentReceipt(ctx, booking, payment) {
  const t = getTranslator(ctx.dbUser?.language_pref || 'en');

  const methodLabel = payment.method === 'chapa' ? 'Chapa (Telebirr/CBE/Card)' : 'Manual Transfer';

  const receiptText =
    `${t('payment.success')}\n\n` +
    `🧾 ${t('payment.receipt_caption')}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💳 ${t('payment.method')}: ${methodLabel}\n` +
    `🔖 ${t('payment.reference')}: ${mdEscape(payment.reference)}\n` +
    `💰 ${t('payment.amount')}: ${formatMoney(payment.amount)} ${currency}\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `${t('booking.reserved_body', {
      code: mdEscape(booking.confirmation_code),
      address: mdEscape(booking.address || '—'),
      start: mdEscape(formatDateTime(booking.start_time)),
      end: mdEscape(formatDateTime(booking.end_time)),
      total: mdEscape(formatMoney(booking.total_price)),
      currency: mdEscape(currency),
    })}\n\n` +
    `_${mdEscape(t('payment.qr_instruction'))}_`;

  // Send receipt text
  await ctx.reply(receiptText, { parse_mode: 'Markdown' });

  // Send QR code for check-in
  if (booking.checkin_token) {
    try {
      const png = await checkinQrPng(checkinLink(booking.checkin_token));
      await ctx.replyWithPhoto(new InputFile(png, 'checkin.png'), {
        caption: t('booking.qr_caption', {
          address: mdEscape(booking.address || '—'),
          start: mdEscape(formatDateTime(booking.start_time)),
          end: mdEscape(formatDateTime(booking.end_time)),
          total: mdEscape(formatMoney(booking.total_price)),
          currency: mdEscape(currency),
          code: mdEscape(booking.confirmation_code),
        }),
        parse_mode: 'Markdown',
      });
    } catch (err) {
      logger.warn('Failed to send QR code', { error: err.message });
    }
  }

  await notifyHostOfConfirmedBooking(booking, ctx);
}

async function notifyHostOfConfirmedBooking(booking, ctx = null) {
  try {
    if (!booking?.id) return;

    const bot = ctx?.api?.sendMessage ? { api: ctx.api } : null;
    if (bot) {
      await sendHostNewBookingNotification(bot, booking);
      return;
    }

    const { getBot } = await import('../botRef.js');
    await sendHostNewBookingNotification(getBot(), booking);
  } catch (err) {
    logger.warn('Host payment notification failed', { error: err.message });
  }
}
