import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import * as drawnNumbersRepo from '../../db/repositories/drawnNumbers.js';
import { formatNumbers, formatDateTime } from '../../utils/format.js';

export function registerDraw(bot) {
  bot.callbackQuery('draw:live', async (ctx) => {
    await ctx.answerCallbackQuery();
    const games = await gameRoundsRepo.listActive();

    // Find the first active game (prefer drawing status)
    const drawGame = games.find(g => g.status === 'drawing') ||
                     games.find(g => g.status === 'active');

    if (!drawGame) {
      // Show next scheduled draw
      const nextDraw = games[0];
      if (nextDraw?.scheduled_draw_at) {
        await ctx.editMessageText(
          ctx.t('draw.next_draw', { time: formatDateTime(nextDraw.scheduled_draw_at) })
        );
      } else {
        await ctx.editMessageText(ctx.t('draw.no_draw'));
      }
      return;
    }

    const drawn = await drawnNumbersRepo.listByGame(drawGame.id);
    const totalToDraw = drawGame.numbers_to_draw;

    if (drawGame.status === 'drawing' || drawn.length > 0) {
      const text = drawn.length < totalToDraw
        ? `${ctx.t('draw.in_progress')}\n\n` +
          `${ctx.t('draw.drawn_numbers', { count: drawn.length, total: totalToDraw })}\n` +
          `${formatNumbers(drawn.map(d => d.number))}\n\n` +
          (drawn.length > 0
            ? ctx.t('draw.latest_number', { number: drawn[drawn.length - 1].number })
            : '')
        : `${ctx.t('draw.completed', { numbers: formatNumbers(drawn.map(d => d.number)) })}`;

      await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    } else {
      await ctx.editMessageText(ctx.t('draw.waiting'));
    }
  });
}
