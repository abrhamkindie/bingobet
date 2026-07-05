/**
 * Vehicle management handlers — add, list, set default, remove vehicles.
 *
 * @module bot/handlers/vehicles
 */

import { InlineKeyboard } from 'grammy';
import * as vehiclesRepo from '../../db/repositories/vehicles.js';
import { allTranslations } from '../../i18n/index.js';
import { botAsyncHandler } from '../utils/botError.js';
import { Flow, clearFlowSession, getFlowSession, setFlowSession } from '../utils/session.js';
import { cancelKeyboard } from '../keyboards.js';
import { trackBotEvent } from '../analytics.js';

// Helper to resume booking flow after adding a vehicle.
async function resumeBookingIfNeeded(ctx, session, vehicle) {
  if (session.resumeBooking) {
    // Resume booking flow with the new vehicle
    const { spotId, offset, hours } = session;
    setFlowSession(ctx.from.id, {
      flow: 'select_vehicle',
      spotId,
      offset,
      hours,
    });
    // Import the booking handler function dynamically to avoid circular deps
    const { default: bookingHandler } = await import('./booking.js');
    // Trigger the vehicle selection callback
    await ctx.answerCallbackQuery();
    await ctx.reply(`✅ ${vehicle.plate_number} selected for booking. Proceeding...`);
    // Simulate the vehicle selection callback
    const booking = await import('../../services/bookingService.js');
    const { reserve } = booking;
    const start = new Date(Date.now() + Number(offset) * 60 * 1000);
    const spotsRepo = await import('../../db/repositories/spots.js');
    const spot = await spotsRepo.getById(spotId);
    const { booking: newBooking } = await reserve({
      driverId: ctx.dbUser.id,
      spotId,
      start,
      hours,
      vehicleId: vehicle.id,
    });
    const { showPaymentOptions } = await import('./payment.js');
    setFlowSession(ctx.dbUser.id, {
      flow: 'booking_complete',
      bookingId: newBooking.id,
    });
    await showPaymentOptions(ctx, newBooking.id);
    return true;
  }
  return false;
}

const VehicleStep = {
  PLATE: 'vehicle_plate',
  TYPE: 'vehicle_type',
  COLOR: 'vehicle_color',
};

function vehicleLine(t, v) {
  const defaultBadge = v.is_default ? ` ${t('vehicles.default_badge')}` : '';
  return `${v.plate_number}${defaultBadge} — ${v.vehicle_type}${v.color ? ` · ${v.color}` : ''}`;
}

function vehicleListKeyboard(t, vehicles) {
  const kb = new InlineKeyboard();
  for (const v of vehicles) {
    const label = v.is_default ? `✅ ${v.plate_number}` : v.plate_number;
    kb.text(label, `vehicle:select:${v.id}`).row();
  }
  kb.text(t('vehicles.add_new'), 'vehicle:add').row();
  kb.text(t('common.back'), 'vehicle:back');
  return kb;
}

function vehicleManageKeyboard(t, vehicle) {
  const kb = new InlineKeyboard();
  if (!vehicle.is_default) {
    kb.text(t('vehicles.set_default'), `vehicle:default:${vehicle.id}`).row();
  }
  kb.text(t('vehicles.remove'), `vehicle:remove:${vehicle.id}`).row();
  kb.text(t('common.back'), 'vehicle:list');
  return kb;
}

export function registerVehicles(bot) {
  // /myvehicles — list user's vehicles
  bot.command('myvehicles', botAsyncHandler(async (ctx) => {
    await showVehicleList(ctx);
  }));

  // Menu button: My Vehicles
  bot.hears(allTranslations('menu.my_vehicles'), botAsyncHandler(async (ctx) => {
    await showVehicleList(ctx);
  }));

  // Show vehicle list
  bot.callbackQuery(/^vehicle:list$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await showVehicleList(ctx);
  }));

  // Start adding a new vehicle
  bot.callbackQuery(/^vehicle:add$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    setFlowSession(ctx.from.id, { flow: Flow.ADD_VEHICLE, step: VehicleStep.PLATE });
    await trackBotEvent(ctx, 'vehicle_add_started');
    await ctx.reply(ctx.t('vehicles.ask_plate'), { reply_markup: cancelKeyboard(ctx.t) });
  }));

  // Select a vehicle from the list
  bot.callbackQuery(/^vehicle:select:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const vehicle = await vehiclesRepo.getById(id, ctx.dbUser.id);
    if (!vehicle) return ctx.reply(ctx.t('common.error_generic'));

    await ctx.reply(
      `${ctx.t('vehicles.detail_title')}\n\n` +
      `🚗 ${vehicle.plate_number}\n` +
      `📦 ${vehicle.vehicle_type}\n` +
      (vehicle.color ? `🎨 ${vehicle.color}\n` : '') +
      (vehicle.is_default ? `⭐ ${ctx.t('vehicles.default_badge')}\n` : ''),
      { reply_markup: vehicleManageKeyboard(ctx.t, vehicle) }
    );
  }));

  // Set as default
  bot.callbackQuery(/^vehicle:default:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const updated = await vehiclesRepo.setDefault(id, ctx.dbUser.id);
    if (!updated) return ctx.reply(ctx.t('common.error_generic'));
    await trackBotEvent(ctx, 'vehicle_default_set', { vehicle_id: id });
    await ctx.reply(ctx.t('vehicles.default_set', { plate: updated.plate_number }));
  }));

  // Remove vehicle — confirm first
  bot.callbackQuery(/^vehicle:remove:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const vehicle = await vehiclesRepo.getById(id, ctx.dbUser.id);
    if (!vehicle) return ctx.reply(ctx.t('common.error_generic'));

    const kb = new InlineKeyboard()
      .text(ctx.t('vehicles.confirm_remove'), `vehicle:removeok:${id}`)
      .row()
      .text(ctx.t('common.cancel'), 'vehicle:list');

    await ctx.reply(
      ctx.t('vehicles.confirm_remove_text', { plate: vehicle.plate_number }),
      { reply_markup: kb }
    );
  }));

  // Confirm removal
  bot.callbackQuery(/^vehicle:removeok:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const removed = await vehiclesRepo.remove(id, ctx.dbUser.id);
    if (!removed) return ctx.reply(ctx.t('common.error_generic'));
    await trackBotEvent(ctx, 'vehicle_removed', { vehicle_id: id });
    await ctx.reply(ctx.t('vehicles.removed', { plate: removed.plate_number }));
  }));

  // Back from vehicle detail
  bot.callbackQuery(/^vehicle:back$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await showVehicleList(ctx);
  }));

  // Handle text input during vehicle add flow
  bot.on('message:text', botAsyncHandler(async (ctx, next) => {
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.ADD_VEHICLE) return next();

    const text = ctx.message.text?.trim();
    if (!text) return next();

    // Cancel
    if (allTranslations('common.cancel').includes(text)) {
      clearFlowSession(ctx.from.id);
      return ctx.reply(ctx.t('vehicles.add_cancelled'));
    }

    switch (s.step) {
      case VehicleStep.PLATE: {
        if (text.length < 3 || text.length > 20) {
          return ctx.reply(ctx.t('vehicles.bad_plate'));
        }
        s.draft = { plateNumber: text };
        s.step = VehicleStep.TYPE;
        setFlowSession(ctx.from.id, s);

        const kb = new InlineKeyboard()
          .text(' Car', 'vehicle:type:car')
          .text('🏍️ Motorcycle', 'vehicle:type:motorcycle')
          .row()
          .text('🚙 SUV', 'vehicle:type:suv')
          .text('🚛 Truck', 'vehicle:type:truck')
          .row()
          .text(ctx.t('common.cancel'), 'vehicle:cancel');

        await ctx.reply(ctx.t('vehicles.ask_type'), { reply_markup: kb });
        break;
      }
      case VehicleStep.COLOR: {
        s.draft.color = text;
        const vehicle = await vehiclesRepo.create({
          userId: ctx.dbUser.id,
          plateNumber: s.draft.plateNumber,
          vehicleType: s.draft.vehicleType,
          color: s.draft.color,
        });
        clearFlowSession(ctx.from.id);
        await trackBotEvent(ctx, 'vehicle_added', { vehicle_id: vehicle.id });
        
        // Resume booking if we came from booking flow
        if (s.resumeBooking) {
          await resumeBookingIfNeeded(ctx, s, vehicle);
        } else {
          await ctx.reply(
            ctx.t('vehicles.added', { plate: vehicle.plate_number }),
            { reply_markup: vehicleManageKeyboard(ctx.t, vehicle) }
          );
        }
        break;
      }
      default:
        return next();
    }
  }));

  // Vehicle type selection
  bot.callbackQuery(/^vehicle:type:(car|motorcycle|suv|truck)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.ADD_VEHICLE || s.step !== VehicleStep.TYPE) return;

    s.draft.vehicleType = ctx.match[1];
    s.step = VehicleStep.COLOR;
    setFlowSession(ctx.from.id, s);

    const kb = new InlineKeyboard()
      .text(ctx.t('common.skip'), 'vehicle:color:skip')
      .row()
      .text(ctx.t('common.cancel'), 'vehicle:cancel');

    await ctx.reply(ctx.t('vehicles.ask_color'), { reply_markup: kb });
  }));

  // Skip color
  bot.callbackQuery(/^vehicle:color:skip$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = getFlowSession(ctx.from.id);
    if (!s || s.flow !== Flow.ADD_VEHICLE) return;

    const vehicle = await vehiclesRepo.create({
      userId: ctx.dbUser.id,
      plateNumber: s.draft.plateNumber,
      vehicleType: s.draft.vehicleType,
      color: null,
    });
    const resumeBooking = s.resumeBooking;
    clearFlowSession(ctx.from.id);
    await trackBotEvent(ctx, 'vehicle_added', { vehicle_id: vehicle.id });
    
    // Resume booking if we came from booking flow
    if (resumeBooking) {
      await resumeBookingIfNeeded(ctx, { ...s, resumeBooking: true }, vehicle);
    } else {
      await ctx.reply(
        ctx.t('vehicles.added', { plate: vehicle.plate_number }),
        { reply_markup: vehicleManageKeyboard(ctx.t, vehicle) }
      );
    }
  }));

  // Cancel vehicle add
  bot.callbackQuery(/^vehicle:cancel$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    clearFlowSession(ctx.from.id);
    await ctx.reply(ctx.t('vehicles.add_cancelled'));
  }));
}

async function showVehicleList(ctx) {
  const vehicles = await vehiclesRepo.listByUser(ctx.dbUser.id);

  if (vehicles.length === 0) {
    const kb = new InlineKeyboard().text(ctx.t('vehicles.add_new'), 'vehicle:add');
    return ctx.reply(ctx.t('vehicles.empty'), { reply_markup: kb });
  }

  const text = `${ctx.t('vehicles.title')}\n\n` +
    vehicles.map((v, i) => `${i + 1}. ${vehicleLine(ctx.t, v)}`).join('\n');

  await ctx.reply(text, { reply_markup: vehicleListKeyboard(ctx.t, vehicles) });
}
