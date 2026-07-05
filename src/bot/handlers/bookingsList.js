/**
 * My Bookings handler — list recent bookings with pagination and filters.
 *
 * @module bot/handlers/bookingsList
 */

import { InlineKeyboard, InputFile } from 'grammy';
import * as bookingsRepo from '../../db/repositories/bookings.js';
import * as spotsRepo from '../../db/repositories/spots.js';
import { formatDateTime, formatMoney, currency } from '../../utils/format.js';
import { allTranslations } from '../../i18n/index.js';
import { checkinQrPng } from '../../utils/qr.js';
import { checkinLink } from '../../utils/deeplink.js';
import { logger } from '../../utils/logger.js';
import { botAsyncHandler } from '../utils/botError.js';
import { setSession, getSession } from '../session.js';

const QR_STATUSES = new Set(['reserved', 'confirmed', 'active']);
const PAGE_SIZE = 5;

// "My bookings" menu button → list recent bookings for this driver.
export function registerBookingsList(bot) {
  bot.hears(allTranslations('menu.my_bookings'), botAsyncHandler(async (ctx) => {
    await showBookingsList(ctx, 0);
  }));

  // Pagination callbacks
  bot.callbackQuery(/^bookings:page:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = Number(ctx.match[1]);
    await showBookingsList(ctx, page);
  }));

  // Filter by status
  bot.callbackQuery(/^bookings:filter:(.+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const status = ctx.match[1];
    setSession(ctx.from.id, { bookingsFilter: status === 'all' ? null : status });
    await showBookingsList(ctx, 0);
  }));

  // Clear filter
  bot.callbackQuery(/^bookings:clearfilter$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    setSession(ctx.from.id, { bookingsFilter: null });
    await showBookingsList(ctx, 0);
  }));

  // Show filter menu
  bot.callbackQuery(/^bookings:filter:menu$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    await showFilterMenu(ctx);
  }));

  // No-op for pagination display
  bot.callbackQuery(/^bookings:noop$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
  }));

  // View booking details
  bot.callbackQuery(/^booking:detail:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const b = await bookingsRepo.getById(id);
    if (!b || String(b.driver_id) !== String(ctx.dbUser.id)) {
      return ctx.reply(ctx.t('common.error_generic'));
    }

    const spot = await spotsRepo.getById(b.spot_id);
    const t = ctx.t;

    let text = `*${t('booking.detail_title')}*\n\n`;
    text += `📍 *${t('booking.detail_address')}:* ${spot?.address || '—'}\n`;
    text += `🔖 *${t('booking.detail_code')}:* \`${b.confirmation_code || '—'}\`\n`;
    text += `📅 *${t('booking.detail_start')}:* ${formatDateTime(b.start_time)}\n`;
    text += `📅 *${t('booking.detail_end')}:* ${formatDateTime(b.end_time)}\n`;
    text += `💰 *${t('booking.detail_total')}:* ${formatMoney(b.total_price)} ${currency}\n`;
    text += `📊 *${t('booking.detail_status')}:* ${t(`status.${b.status}`)}\n`;
    text += `💳 *${t('booking.detail_payment')}:* ${t(`payment_status.${b.payment_status}`)}\n`;

    if (b.vehicle_id) {
      const vehiclesRepo = await import('../../db/repositories/vehicles.js');
      const vehicle = await vehiclesRepo.getById(b.vehicle_id, ctx.dbUser.id);
      if (vehicle) {
        text += `🚗 *${t('booking.detail_vehicle')}:* ${vehicle.plate_number}`;
        if (vehicle.color) text += ` (${vehicle.color})`;
        text += '\n';
      }
    }

    // Add access instructions if available
    if (spot?.access_instructions) {
      text += `\n📝 *${t('booking.access_instructions')}:*\n${spot.access_instructions}\n`;
    }

    const kb = new InlineKeyboard();
    
    // Add navigation button if spot has coordinates
    if (spot?.lat && spot?.lng) {
      const { directionsUrl } = await import('../../utils/maps.js');
      kb.url(t('booking.get_directions'), directionsUrl(spot.lat, spot.lng)).row();
    }

    // Add QR button if applicable
    if (QR_STATUSES.has(b.status) && b.checkin_token) {
      kb.text(t('booking.show_qr_button'), `booking:qr:${b.id}`).row();
    }

    kb.text(t('common.back'), 'bookings:page:0');

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
  }));

  // Re-send a booking's QR (driver-only).
  bot.callbackQuery(/^booking:qr:(\d+)$/, botAsyncHandler(async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = Number(ctx.match[1]);
    const b = await bookingsRepo.getById(id);
    if (!b || String(b.driver_id) !== String(ctx.dbUser.id) || !b.checkin_token) {
      return ctx.reply(ctx.t('common.error_generic'));
    }
    try {
      const spot = await spotsRepo.getById(b.spot_id);
      const png = await checkinQrPng(checkinLink(b.checkin_token));
      await ctx.replyWithPhoto(new InputFile(png, 'checkin.png'), {
        caption: ctx.t('booking.qr_caption', {
          address: spot?.address || '—',
          start: formatDateTime(b.start_time),
          end: formatDateTime(b.end_time),
          total: formatMoney(b.total_price),
          currency,
          code: b.confirmation_code,
        }),
        parse_mode: 'Markdown',
      });
    } catch (err) {
      logger.warn('show qr failed', { error: err.message });
      await ctx.reply(ctx.t('common.error_generic'));
    }
  }));
}

// Helper to show paginated bookings list with filters.
async function showBookingsList(ctx, page) {
  const t = ctx.t;
  const session = getSession(ctx.from.id) || {};
  const filter = session.bookingsFilter;
  const offset = page * PAGE_SIZE;

  const result = await bookingsRepo.listByDriver(ctx.dbUser.id, PAGE_SIZE, offset, { status: filter });
  const { bookings: rows, total } = result;

  if (!rows.length && page === 0) {
    return ctx.reply(t('booking.none'));
  }

  const filterLabel = filter ? t(`status.${filter}`) : t('bookings.all_statuses');
  const header = `${t('bookings.title')} (${total} ${t('bookings.total')})\n` +
    `${t('bookings.filter')}: ${filterLabel}\n\n`;

  const items = rows.map((b) =>
    t('booking.list_item', {
      code: b.confirmation_code || '—',
      address: b.address || '—',
      start: formatDateTime(b.start_time),
      end: formatDateTime(b.end_time),
      status: t(`status.${b.status}`),
      total: formatMoney(b.total_price),
      currency,
    })
  );

  const kb = new InlineKeyboard();

  // Detail + QR buttons for each booking
  for (const b of rows) {
    kb.text(`📋 ${b.confirmation_code || b.id}`, `booking:detail:${b.id}`);
    if (QR_STATUSES.has(b.status) && b.checkin_token) {
      kb.text(t('booking.show_qr_button'), `booking:qr:${b.id}`);
    }
    kb.row();
  }

  // Filter buttons
  kb.row();
  kb.text(t('bookings.filter_btn'), 'bookings:filter:menu');

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages > 1) {
    kb.row();
    if (page > 0) {
      kb.text('◀️', `bookings:page:${page - 1}`);
    }
    kb.text(`${page + 1}/${totalPages}`, 'bookings:noop');
    if (page < totalPages - 1) {
      kb.text('▶️', `bookings:page:${page + 1}`);
    }
  }

  await ctx.reply(header + items.join('\n\n'), { reply_markup: kb });
}

// Filter menu callback
async function showFilterMenu(ctx) {
  const t = ctx.t;
  const kb = new InlineKeyboard()
    .text(t('bookings.all_statuses'), 'bookings:clearfilter').row()
    .text(t('status.pending'), 'bookings:filter:pending').row()
    .text(t('status.reserved'), 'bookings:filter:reserved').row()
    .text(t('status.confirmed'), 'bookings:filter:confirmed').row()
    .text(t('status.active'), 'bookings:filter:active').row()
    .text(t('status.completed'), 'bookings:filter:completed').row()
    .text(t('status.cancelled'), 'bookings:filter:cancelled').row()
    .text(t('common.back'), 'bookings:page:0');

  await ctx.reply(t('bookings.select_filter'), { reply_markup: kb });
}
