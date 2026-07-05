import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import * as ticketsRepo from '../../db/repositories/tickets.js';
import * as drawnNumbersRepo from '../../db/repositories/drawnNumbers.js';
import { resultsKeyboard } from '../keyboards.js';
import { formatMoney, currency, formatNumbers, formatDateTime } from '../../utils/format.js';

export function registerResults(bot) {
  bot.callbackQuery('results:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await gameRoundsRepo.getCompletedWithStats();

    if (!result.games.length) {
      await ctx.editMessageText(ctx.t('results.none'));
      return;
    }

    await ctx.editMessageText(ctx.t('results.title'), {
      reply_markup: resultsKeyboard(ctx.t, result.games),
    });
  });

  bot.callbackQuery(/^result:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const games = await gameRoundsRepo.getCompletedWithStats();
    const game = games.games.find(g => g.id === gameId);

    if (!game) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    const drawnNumbers = game.drawn_numbers || [];
    const playerTickets = await ticketsRepo.listByGameAndPlayer(gameId, ctx.dbPlayer.id);

    let text = ctx.t('results.game_header', {
      title: game.title,
      drawn_at: game.drawn_at ? formatDateTime(game.drawn_at) : '—',
      winners: game.winner_count,
      prize_pool: formatMoney(game.prize_pool),
      currency,
      payout: formatMoney(game.total_payout),
    });

    text += `\n\n${ctx.t('results.drawn_numbers', { numbers: formatNumbers(drawnNumbers) })}`;

    if (playerTickets.length) {
      text += `\n\n*${ctx.t('results.your_tickets')}:*`;
      playerTickets.forEach(t => {
        const status = t.is_winner
          ? `🏆 ${ctx.t('status.won')} (+${formatMoney(t.prize_amount)} ${currency})`
          : t.status === 'lost' ? ctx.t('status.lost') : ctx.t('status.active');
        text += `\n#${t.position}: ${formatNumbers(t.numbers)} — ${status}`;
      });
    } else {
      text += `\n\n${ctx.t('results.no_tickets_played')}`;
    }

    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
  });
}
