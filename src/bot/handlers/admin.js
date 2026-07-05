import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import * as playersRepo from '../../db/repositories/players.js';
import { startDraw, createGame } from '../../services/gameService.js';
import { adminMenuKeyboard, adminGamesKeyboard, adminGameActionsKeyboard, drawConfirmKeyboard } from '../keyboards.js';
import { formatMoney, currency } from '../../utils/format.js';
import { logger } from '../../utils/logger.js';

export function registerAdmin(bot) {
  // Admin menu
  bot.callbackQuery('admin:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.dbPlayer?.role !== 'admin') {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }
    await ctx.editMessageText(ctx.t('admin.menu_title'), {
      reply_markup: adminMenuKeyboard(ctx.t),
    });
  });

  // List games
  bot.callbackQuery('admin:games:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await gameRoundsRepo.listAll();
    await ctx.editMessageText(ctx.t('admin.manage_games'), {
      reply_markup: adminGamesKeyboard(ctx.t, result.games),
    });
  });

  // View single game
  bot.callbackQuery(/^admin:game:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const game = await gameRoundsRepo.getById(gameId);
    if (!game) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    const text = `*${game.title}*\n` +
      `Status: ${game.status}\n` +
      `Tickets: ${game.tickets_sold}/${game.max_tickets}\n` +
      `Prize Pool: ${formatMoney(game.prize_pool)} ${currency}\n` +
      `Ticket Price: ${formatMoney(game.ticket_price)} ${currency}\n` +
      `Platform Fee: ${game.platform_fee_percent}%\n` +
      (game.winner_count > 0 ? `Winners: ${game.winner_count}\nPayout: ${formatMoney(game.total_payout)} ${currency}\n` : '');

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: adminGameActionsKeyboard(ctx.t, game),
    });
  });

  // Start draw confirmation
  bot.callbackQuery(/^admin:draw:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);
    const game = await gameRoundsRepo.getById(gameId);
    if (!game) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
      return;
    }

    await ctx.editMessageText(
      ctx.t('admin.draw_confirm', {
        title: game.title,
        sold: game.tickets_sold,
        pool: formatMoney(game.prize_pool),
        currency,
      }),
      { reply_markup: drawConfirmKeyboard(ctx.t, gameId) }
    );
  });

  // Execute draw
  bot.callbackQuery(/^admin:draw:confirm:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const gameId = Number(ctx.match[1]);

    try {
      const result = await startDraw(gameId);
      logger.info('Admin started draw', { gameId, adminId: ctx.dbPlayer.id });

      await ctx.editMessageText(
        ctx.t('admin.game_completed', {
          title: result?.title || gameId,
          winners: result?.winner_count || 0,
          payout: formatMoney(result?.total_payout || 0),
          currency,
        })
      );
    } catch (err) {
      await ctx.editMessageText(ctx.t('common.error_generic'));
    }
  });

  // Players list
  bot.callbackQuery('admin:players:list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const result = await playersRepo.listAll({ limit: 20 });
    const text = ctx.t('admin.players_title') + '\n\n' +
      result.players.map(p =>
        ctx.t('admin.player_line', {
          name: p.name || '—',
          username: p.username || '—',
          balance: formatMoney(p.wallet_balance),
          currency,
          tickets: p.ticket_count || 0,
          won: formatMoney(p.total_won),
        })
      ).join('\n\n');

    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
  });

  // Create game wizard (simplified - just creates with defaults for now)
  bot.callbackQuery('admin:create:title', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(ctx.t('admin.title_prompt'));

    // Wait for text input
    bot.on('message:text', async (msgCtx) => {
      if (!msgCtx.dbPlayer || msgCtx.dbPlayer.role !== 'admin') return;

      const title = msgCtx.message.text;
      await msgCtx.reply(`Creating game: "${title}" with default settings:\n` +
        `• Ticket Price: 50 ETB\n` +
        `• Max Tickets: 1000\n` +
        `• Numbers: 1-50, 6 per ticket, 6 drawn\n` +
        `• Draw: Scheduled\n` +
        `• Prize Tiers: Match 3 (2x), Match 4 (10x), Match 5 (50x), Match 6 (Jackpot)\n` +
        `• Platform Fee: 10%\n\n` +
        `Game created!`);

      try {
        const game = await createGame({
          title,
          description: 'Good luck!',
          ticketPrice: 50,
          maxTickets: 1000,
          maxPerPlayer: 10,
          prizeTiers: null,
          drawType: 'scheduled',
          platformFeePercent: 10,
        });
        logger.info('Admin created game', { gameId: game.id, adminId: msgCtx.dbPlayer.id });
      } catch (err) {
        await msgCtx.reply('Error creating game.');
      }
    }, { once: true });
  });
}
