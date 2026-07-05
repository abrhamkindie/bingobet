/**
 * Start and help command handlers.
 *
 * @module bot/handlers/start
 */

import { config } from '../../config/index.js';
import {
  languageKeyboard,
  welcomeKeyboard,
} from '../keyboards.js';
import { handleCheckin, checkInByCode } from './checkin.js';
import { beginBooking } from './booking.js';
import { showHelpMenu } from '../help.js';
import { botAsyncHandler } from '../utils/botError.js';
import { trackBotEvent } from '../analytics.js';

// /start — if the user has no explicit language yet, ask; otherwise greet.
export function registerStart(bot) {
  bot.command('start', botAsyncHandler(async (ctx) => {
    const payload = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    await trackBotEvent(ctx, 'bot_start', {
      payload_type: payload.startsWith('checkin_') ? 'checkin' : payload.startsWith('book_') ? 'booking' : payload ? 'other' : 'none',
      is_new_user: Boolean(ctx.dbUser?.is_new),
    });
    if (payload.startsWith('checkin_')) {
      return handleCheckin(ctx, payload.slice('checkin_'.length));
    }
    if (payload.startsWith('book_')) {
      const spotId = Number(payload.slice('book_'.length));
      if (Number.isFinite(spotId)) return beginBooking(ctx, spotId);
    }
    const t = ctx.t;
    // Only ask brand-new users to pick a language; returning users go straight to
    // a warm welcome so /start isn't a language quiz every time.
    if (ctx.dbUser?.is_new) {
      await ctx.reply(t('start.choose_language', { app: config.appName }), {
        reply_markup: languageKeyboard(t),
      });
      return;
    }
    await sendMainMenu(ctx, { returning: true });
  }));

  // Manual check-in by confirmation code — owner types /checkin PK-ABC12
  bot.command('checkin', botAsyncHandler(async (ctx) => {
    const code = typeof ctx.match === 'string' ? ctx.match.trim() : '';
    await trackBotEvent(ctx, 'checkin_command', { has_code: Boolean(code) });
    if (!code) {
      return ctx.reply(ctx.t('checkin.usage_manual'));
    }
    return checkInByCode(ctx, code);
  }));

  // Help command — shows interactive, categorized support menu (role-aware).
  bot.command('help', botAsyncHandler(async (ctx) => {
    await trackBotEvent(ctx, 'help_opened', { role: ctx.dbUser?.role || 'driver' });
    await showHelpMenu(ctx, ctx.dbUser?.role || 'driver');
  }));
}

// Sends the welcome message with Mini App button.
// The Mini App is the primary interface - no persistent reply keyboard.
export async function sendMainMenu(ctx, { returning = false } = {}) {
  const t = ctx.t;
  const name = ctx.dbUser?.name ? ` ${ctx.dbUser.name}` : '';
  const text = returning
    ? t('start.welcome_back', { name })
    : t('start.welcome_driver', { name: ctx.dbUser?.name || '' });

  // Build Mini App URL if available
  const miniAppUrl = config.publicUrl?.startsWith('https://')
    ? `${config.publicUrl}/miniapp/`
    : null;

  await ctx.reply(text, { reply_markup: welcomeKeyboard(t, miniAppUrl) });
}
