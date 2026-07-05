import * as playersRepo from '../../db/repositories/players.js';
import { logger } from '../../utils/logger.js';
import { getTranslator, SUPPORTED_LANGS } from '../../i18n/index.js';

export function playerMiddleware() {
  return async (ctx, next) => {
    try {
      if (!ctx.from) return await next();

      const tgUser = ctx.from;
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
      const dbPlayer = await playersRepo.upsertPlayer({
        telegramId: tgUser.id,
        name,
        username: tgUser.username,
      });

      ctx.dbPlayer = dbPlayer;
      ctx.t = getTranslator(dbPlayer.language_pref || 'en');

      if (dbPlayer.is_banned) {
        await ctx.reply(ctx.t('common.banned'));
        return;
      }

      await next();
    } catch (err) {
      logger.error('Player middleware error', { error: err.message });
      await next();
    }
  };
}
