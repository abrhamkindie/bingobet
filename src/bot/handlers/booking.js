/**
 * Booking flow handlers — start time, duration, confirmation, reservation.
 *
 * @module bot/handlers/booking
 */

import * as spotsRepo from '../../db/repositories/spots.js';
import * as usersRepo from '../../db/repositories/users.js';
import * as vehiclesRepo from '../../db/repositories/vehicles.js';
import { reserve } from '../../services/bookingService.js';
import { calcTotal } from '../../services/pricing.js';
import {
  startTimeKeyboard,
  durationKeyboard,
  confirmBookingKeyboard,
  cancelKeyboard,
} from '../keyboards.js';
import { formatDateTime, formatMoney, currency } from '../../utils/format.js';
import { setSession, getSession } from '../session.js';
import { showPaymentOptions } from './payment.js';
import { logger } from '../../utils/logger.js';
import { botAsyncHandler } from '../utils/botError.js';
import { Flow } from '../utils/session.js';
import { trackBotEvent } from '../analytics.js';
import { InlineKeyboard } from 'grammy';
import { directionsUrl } from '../../utils/maps.js';

// Compute the start Date from an offset-in-minutes from "now".
function startFromOffset(offsetMin) {
  return new Date(Date.now() + Number(offsetMin) * 60 * 1000);
}

// Check if user needs to select a vehicle before booking.
// Returns: null if no action needed, or { needsVehicle: true, vehicles: [...] }
async function checkVehicleSelection(userId) {
  const vehicles = await vehiclesRepo.listByUser(userId);
  if (vehicles.length === 0) {
    return { needsVehicle: true, vehicles: [], hasDefault: false };
  }
  const defaultVehicle = vehicles.find(v => v.is_default);
  return {
    needsVehicle: false,
    vehicles,
    defaultVehicle,
    hasDefault: !!defaultVehicle,
  };
}

// Show vehicle selection keyboard.
async function showVehicleSelection(ctx, spotId, offset, hours) {
  const vehicles = await vehiclesRepo.listByUser(ctx.dbUser.id);
  
  if (vehicles.length === 0) {
    // No vehicles - prompt to add one
    const kb = new InlineKeyboard()
      .text(ctx.t('vehicles.add_new'), 'vehicle:add:booking')
      .row()
      .text(ctx.t('common.cancel'), 'book:cancel');
    await ctx.reply(ctx.t('booking.no_vehicles'), { reply_markup: kb });
    return false;
  }

  // Store booking params for after vehicle selection
  setSession(ctx.from.id, {
    flow: Flow.SELECT_VEHICLE,
    spotId,
    offset,
    hours,
  });

  const kb = new InlineKeyboard();
  for (const v of vehicles) {
    const label = v.is_default ? `✅ ${v.plate_number}` : v.plate_number;
    kb.text(label, `book:vehicle:${v.id}`).row();
  }
  kb.text(ctx.t('vehicles.add_new'), 'vehicle:add:booking').row();
  kb.text(ctx.t('common.cancel'), 'book:cancel');

  await ctx.reply(ctx.t('booking.select_vehicle'), { reply_markup: kb });
  return true;
}

// Create booking with selected vehicle.
async function createBookingWithVehicle(ctx, spotId, offset, hours, vehicleId) {
  const start = startFromOffset(offset);
  const vehicle = await vehiclesRepo.getById(vehicleId, ctx.dbUser.id);

  const { booking, spot } = await reserve({
    driverId: ctx.dbUser.id,
    spotId,
    start,
    hours,
    vehicleId,
  });
  await trackBotEvent(ctx, 'booking_created', {
    booking_id: booking.id,
    spot_id: spotId,
    hours,
    total_price: Number(booking.total_price || 0),
    vehicle_id: vehicleId,
  });

  const vehicleInfo = vehicle ? `\n🚗 ${vehicle.plate_number}` : '';

  const text =
    `${ctx.t('booking.reserved_title')}\n\n` +
    ctx.t('booking.reserved_body', {
      code: booking.confirmation_code,
      address: spot.address || '—',
      start: formatDateTime(booking.start_time),
      end: formatDateTime(booking.end_time),
      total: formatMoney(booking.total_price),
      currency,
    }) +
    vehicleInfo +
    `\n\n_${ctx.t('booking.next_step')}_`;

  // Add navigation button if spot has coordinates
  const kb = new InlineKeyboard();
  if (spot.lat && spot.lng) {
    kb.url(ctx.t('booking.get_directions'), directionsUrl(spot.lat, spot.lng));
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });

  // Store booking in session for payment flow
  setSession(ctx.dbUser.id, {
    flow: Flow.BOOKING_COMPLETE,
    bookingId: booking.id,
  });

  // Show payment options
  await showPaymentOptions(ctx, booking.id);

  // Host notification is sent after payment confirmation (in paymentService.js)
  // to avoid notifying about unpaid/pending bookings.
}

// Notify the host that their spot was just reserved.
async function notifyHost(ctx, spot, booking) {
  try {
    const host = await usersRepo.getById(spot.owner_id);
    if (!host) return;
    const ht = (await import('../../i18n/index.js')).getTranslator(host.language_pref);
    const text =
      `${ht('booking.host_notified_title')}\n\n` +
      ht('booking.host_notified_body', {
        address: spot.address || '—',
        code: booking.confirmation_code,
        start: formatDateTime(booking.start_time),
        end: formatDateTime(booking.end_time),
        driver: ctx.dbUser?.name || ctx.from.first_name || '—',
        total: formatMoney(booking.total_price),
        currency,
      });
    await ctx.api.sendMessage(Number(host.telegram_id), text);
  } catch (err) {
    // Host may have never started the bot; don't fail the booking over a notify.
    logger.warn('host notify failed', { error: err.message });
  }
}

// Begin the booking flow for a spot: shows the start-time choices. Shared by the
// `book:start:<id>` callback and the `start=book_<id>` deep link (from the map).
export async function beginBooking(ctx, spotId) {
  const spot = await spotsRepo.getById(spotId);
  if (!spot) return ctx.reply(ctx.t('booking.spot_unavailable'));
  await trackBotEvent(ctx, 'booking_started', { spot_id: spotId });
  await ctx.reply(ctx.t('booking.choose_start'), {
    reply_markup: startTimeKeyboard(ctx.t, spotId),
  });
}

export function registerBooking(bot) {
  // Step 1: choose start time.
  bot.callbackQuery(/^book:start:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await beginBooking(ctx, Number(ctx.match[1]));
  }));

  // Back from the duration step → re-show the start-time choices (edit in place).
  bot.callbackQuery(/^book:to_start:(\d+)$/, botAsyncHandler(async (ctx) => {
    const spotId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ctx.t('booking.choose_start'), {
      reply_markup: startTimeKeyboard(ctx.t, spotId),
    });
  }));

  // Step 2: chose start offset → choose duration.
  bot.callbackQuery(/^book:start_at:(\d+):(\d+)$/, botAsyncHandler(async (ctx) => {
    const spotId = Number(ctx.match[1]);
    const offset = Number(ctx.match[2]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ctx.t('booking.choose_duration'), {
      reply_markup: durationKeyboard(ctx.t, spotId, offset),
    });
  }));

  // Custom duration: prompt user to type hours.
  bot.callbackQuery(/^book:custom_dur:(\d+):(\d+)$/, botAsyncHandler(async (ctx) => {
    const spotId = Number(ctx.match[1]);
    const offset = Number(ctx.match[2]);
    await ctx.answerCallbackQuery();

    // Store pending booking state so the text handler knows this is a custom duration input.
    setSession(ctx.from.id, {
      flow: Flow.PENDING_DURATION,
      spotId,
      offset,
    });

    // Send a NEW message with the reply keyboard (can't editMessageText to swap inline→reply).
    await ctx.reply(ctx.t('booking.custom_duration_prompt'), {
      reply_markup: cancelKeyboard(ctx.t),
    });
  }));

  // Handle custom duration text input (when user types a number).
  bot.on('message:text', botAsyncHandler(async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (!s || s.flow !== Flow.PENDING_DURATION) return next();

    const hours = parseInt(ctx.message.text, 10);
    if (isNaN(hours) || hours < 1 || hours > 72) {
      return ctx.reply(ctx.t('booking.custom_duration_prompt'));
    }

    const { spotId, offset } = s;
    // Clear the pending state
    setSession(ctx.from.id, null);

    // Redirect to the confirm step with custom hours
    const spot = await spotsRepo.getById(spotId);
    if (!spot) return ctx.reply(ctx.t('booking.spot_unavailable'));

    const start = startFromOffset(offset);
    const end = new Date(start.getTime() + hours * 3600 * 1000);
    const total = calcTotal(spot.price_per_hour, hours);
    await trackBotEvent(ctx, 'booking_duration_selected', { spot_id: spotId, custom_duration: true, hours });

    const summary =
      `${ctx.t('booking.summary_title')}\n\n` +
      ctx.t('booking.summary_body', {
        address: spot.address || '—',
        start: formatDateTime(start),
        end: formatDateTime(end),
        hours,
        total: formatMoney(total),
        currency,
      }) +
      `\n\n_${ctx.t('booking.confirm_pending_note')}_`;

    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      reply_markup: confirmBookingKeyboard(ctx.t, spotId, offset, hours),
    });
  }));

  // Step 3: chose duration → show summary.
  bot.callbackQuery(/^book:dur:(\d+):(\d+):(\d+)$/, botAsyncHandler(async (ctx) => {
    const spotId = Number(ctx.match[1]);
    const offset = Number(ctx.match[2]);
    const hours = Number(ctx.match[3]);
    await ctx.answerCallbackQuery();

    const spot = await spotsRepo.getById(spotId);
    if (!spot) return ctx.reply(ctx.t('booking.spot_unavailable'));

    const start = startFromOffset(offset);
    const end = new Date(start.getTime() + hours * 3600 * 1000);
    const total = calcTotal(spot.price_per_hour, hours);
    await trackBotEvent(ctx, 'booking_duration_selected', { spot_id: spotId, custom_duration: false, hours });

    const summary =
      `${ctx.t('booking.summary_title')}\n\n` +
      ctx.t('booking.summary_body', {
        address: spot.address || '—',
        start: formatDateTime(start),
        end: formatDateTime(end),
        hours,
        total: formatMoney(total),
        currency,
      }) +
      `\n\n_${ctx.t('booking.confirm_pending_note')}_`;

    await ctx.editMessageText(summary, {
      parse_mode: 'Markdown',
      reply_markup: confirmBookingKeyboard(ctx.t, spotId, offset, hours),
    });
  }));

  // Step 4: confirm → check vehicle selection, then create reservation.
  bot.callbackQuery(/^book:confirm:(\d+):(\d+):(\d+)$/, botAsyncHandler(async (ctx) => {
    const spotId = Number(ctx.match[1]);
    const offset = Number(ctx.match[2]);
    const hours = Number(ctx.match[3]);
    await ctx.answerCallbackQuery();

    // Check if user has vehicles
    const vehicleCheck = await checkVehicleSelection(ctx.dbUser.id);
    
    if (vehicleCheck.needsVehicle) {
      // No vehicles - prompt to add one
      const kb = new InlineKeyboard()
        .text(ctx.t('vehicles.add_new'), 'vehicle:add:booking')
        .row()
        .text(ctx.t('common.cancel'), 'book:cancel');
      await ctx.reply(ctx.t('booking.no_vehicles'), { reply_markup: kb });
      return;
    }

    if (vehicleCheck.hasDefault) {
      // Has default vehicle - proceed directly with booking
      await createBookingWithVehicle(ctx, spotId, offset, hours, vehicleCheck.defaultVehicle.id);
    } else if (vehicleCheck.vehicles.length === 1) {
      // Only one vehicle - use it
      await createBookingWithVehicle(ctx, spotId, offset, hours, vehicleCheck.vehicles[0].id);
    } else {
      // Multiple vehicles, no default - show selection
      await showVehicleSelection(ctx, spotId, offset, hours);
    }
  }));

  // Handle vehicle selection for booking
  bot.callbackQuery(/^book:vehicle:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const vehicleId = Number(ctx.match[1]);
    const s = getSession(ctx.from.id);
    if (!s || s.flow !== Flow.SELECT_VEHICLE) return;

    const { spotId, offset, hours } = s;
    await createBookingWithVehicle(ctx, spotId, offset, hours, vehicleId);
  }));

  // Add vehicle from booking flow
  bot.callbackQuery(/^vehicle:add:booking$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getSession(ctx.from.id);
    // Store the booking context so we can resume after adding vehicle
    if (s && (s.flow === Flow.SELECT_VEHICLE || s.flow === Flow.BOOKING_COMPLETE)) {
      setSession(ctx.from.id, { ...s, flow: Flow.ADD_VEHICLE, step: 'vehicle_plate', resumeBooking: true });
    } else {
      setSession(ctx.from.id, { flow: Flow.ADD_VEHICLE, step: 'vehicle_plate' });
    }
    await ctx.reply(ctx.t('vehicles.ask_plate'), { reply_markup: cancelKeyboard(ctx.t) });
  }));

  // Cancel at any booking step.
  bot.callbackQuery('book:cancel', botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await trackBotEvent(ctx, 'booking_cancelled');
    await ctx.editMessageText(ctx.t('booking.cancelled')).catch(() => {});
  }));
}
