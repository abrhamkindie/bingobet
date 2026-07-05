import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import { gamesKeyboard, gameDetailKeyboard } from '../keyboards.js';
import { formatMoney, currency, formatDateTime } from '../../utils/format.js';

export function registerGames(bot) {
  // List active games
  bot.callbackQuery('games:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const games = await gameRoundsRepo.listActive();

    if (!games.length) {
      await ctx.editMessageText(ctx.t('games.none'));
      return;
    }

    const kb = gamesKeyboard(ctx.t, games);
    await ctx.editMessageText(ctx.t('games.title'), { reply_markup: kb });
  });

  // View game detail
  bot.callbackQuery(/^game:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const game = await gameRoundsRepo.getById(gameId);
    if (!game) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    const tiers = typeof game.prize_tiers === 'string'
      ? JSON.parse(game.prize_tiers)
      : game.prize_tiers;

    const prizeTiersText = (tiers || []).map(tier =>
      ctx.t('games.prize_tier', { match: tier.match, label: tier.label })
    ).join('\n');

    const drawTime = game.scheduled_draw_at
      ? formatDateTime(game.scheduled_draw_at)
      : 'Manual';

    const text = ctx.t('games.detail_body', {
      title: game.title,
      description: game.description || '',
      price: formatMoney(game.ticket_price),
      currency,
      sold: game.tickets_sold,
      max: game.max_tickets,
      max_per_player: game.max_tickets_per_player,
      num_min: game.number_min,
      num_max: game.number_max,
      per_ticket: game.numbers_per_ticket,
      to_draw: game.numbers_to_draw,
      prize_pool: formatMoney(game.prize_pool),
      prize_tiers: prizeTiersText,
      draw_time: drawTime,
    });

    await ctx.editMessageText(text, {
      reply_markup: gameDetailKeyboard(ctx.t, game),
      parse_mode: 'Markdown',
    });
  });
}
