import * as ticketsRepo from '../../db/repositories/tickets.js';
import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import { buyTicket } from '../../services/gameService.js';
import { confirmBuyKeyboard, myTicketsKeyboard } from '../keyboards.js';
import { formatMoney, currency, formatNumbers, formatDateTime } from '../../utils/format.js';
import { logger } from '../../utils/logger.js';

export function registerTickets(bot) {
  // My tickets list
  bot.callbackQuery('tickets:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await ticketsRepo.listByPlayer(ctx.dbPlayer.id);

    if (!result.tickets.length) {
      await ctx.editMessageText(ctx.t('ticket.none'));
      return;
    }

    const text = ctx.t('ticket.my_tickets_title');
    await ctx.editMessageText(text, {
      reply_markup: myTicketsKeyboard(ctx.t, result.tickets),
    });
  });

  // Pagination
  bot.callbackQuery(/^tickets:page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = Number(ctx.match[1]);
    const result = await ticketsRepo.listByPlayer(ctx.dbPlayer.id, { limit: 20, offset: page * 5 });

    await ctx.editMessageReplyMarkup({
      reply_markup: myTicketsKeyboard(ctx.t, result.tickets, page),
    });
  });

  // View ticket detail
  bot.callbackQuery(/^ticket:view:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const ticketId = Number(ctx.match[1]);
    const ticket = await ticketsRepo.getById(ticketId);
    if (!ticket || String(ticket.player_id) !== String(ctx.dbPlayer.id)) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    const isWinner = ticket.status === 'won';
    const statusText = isWinner
      ? `🏆 ${ctx.t('status.won')}`
      : ticket.status === 'lost'
        ? ctx.t('status.lost')
        : ctx.t('status.active');

    const text = isWinner
      ? ctx.t('ticket.winner_line', {
          position: ticket.position,
          game_title: ticket.game_title,
          numbers: formatNumbers(ticket.numbers),
          matched: ticket.matched_count,
          total_drawn: ticket.numbers_to_draw,
          prize: formatMoney(ticket.prize_amount),
          currency,
        })
      : ctx.t('ticket.ticket_line', {
          position: ticket.position,
          game_title: ticket.game_title,
          numbers: formatNumbers(ticket.numbers),
          status: statusText,
        });

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
    });
  });

  // Buy ticket - show game
  bot.callbackQuery(/^ticket:buy:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const game = await gameRoundsRepo.getById(gameId);
    if (!game || (game.status !== 'active' && game.status !== 'upcoming')) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    await ctx.editMessageText(
      ctx.t('ticket.confirm_purchase', {
        title: game.title,
        price: formatMoney(game.ticket_price),
        currency,
        numbers: `${game.numbers_per_ticket} numbers (${game.number_min}-${game.number_max})`,
      }),
      { reply_markup: confirmBuyKeyboard(ctx.t, gameId) }
    );
  });

  // Confirm buy
  bot.callbackQuery(/^ticket:confirm:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);

    try {
      const result = await buyTicket({
        playerId: ctx.dbPlayer.id,
        gameRoundId: gameId,
      });

      const ticket = result.ticket;
      const game = await gameRoundsRepo.getById(gameId);

      await ctx.editMessageText(
        ctx.t('ticket.purchased', {
          title: game.title,
          position: ticket.position,
          numbers: formatNumbers(ticket.numbers),
          draw_time: game.scheduled_draw_at ? formatDateTime(game.scheduled_draw_at) : 'Manual',
        }),
        { parse_mode: 'Markdown' }
      );

      logger.info('Player bought ticket', {
        playerId: ctx.dbPlayer.id,
        gameId,
        ticketId: ticket.id,
      });
    } catch (err) {
      const msg = err.code === 'INSUFFICIENT_BALANCE'
        ? ctx.t('wallet.withdraw_insufficient', { balance: formatMoney(ctx.dbPlayer.wallet_balance), currency })
        : err.code === 'GAME_SOLD_OUT'
          ? ctx.t('games.sold_out')
          : err.code === 'PLAYER_TICKET_LIMIT_REACHED'
            ? ctx.t('games.ticket_limit')
            : ctx.t('common.error_generic');
      await ctx.editMessageText(msg);
    }
  });
}
