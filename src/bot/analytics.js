import * as botEventsRepo from '../db/repositories/botEvents.js';
import { logger } from '../utils/logger.js';

function updateKind(ctx) {
  if (ctx.update?.message?.location) return 'location';
  if (ctx.update?.message?.photo) return 'photo';
  if (ctx.update?.message?.web_app_data) return 'web_app_data';
  if (ctx.update?.message?.text) return ctx.update.message.text.startsWith('/') ? 'command' : 'text';
  if (ctx.update?.callback_query) return 'callback';
  return Object.keys(ctx.update || {}).find((k) => k !== 'update_id') || 'unknown';
}

export async function trackBotEvent(ctx, eventName, metadata = {}) {
  try {
    await botEventsRepo.trackEvent({
      userId: ctx.dbUser?.id,
      telegramId: ctx.from?.id,
      updateId: ctx.update?.update_id,
      eventName,
      metadata,
    });
  } catch (err) {
    logger.warn('bot analytics event failed', {
      eventName,
      error: err.message,
    });
  }
}

export function botAnalyticsMiddleware() {
  return async (ctx, next) => {
    await trackBotEvent(ctx, 'bot_update', {
      kind: updateKind(ctx),
      role: ctx.dbUser?.role,
      language: ctx.dbUser?.language_pref,
    });
    return next();
  };
}
