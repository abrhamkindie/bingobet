import { Router } from 'express';
import { telegramAuth } from '../middlewares/telegramAuth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { success } from '../utils/apiResponse.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

import * as gameRoundsRepo from '../db/repositories/gameRounds.js';
import * as ticketsRepo from '../db/repositories/tickets.js';
import * as drawnNumbersRepo from '../db/repositories/drawnNumbers.js';
import * as playersRepo from '../db/repositories/players.js';
import * as transactionsRepo from '../db/repositories/transactions.js';

import { buyTicket, startDraw, listActiveGames, getGameDetail } from '../services/gameService.js';
import { getWalletInfo, initiateDeposit, requestWithdrawal } from '../services/walletService.js';
import { formatMoney } from '../utils/format.js';

export function createMiniAppRouter() {
  const router = Router();
  router.use(telegramAuth());

  // Player profile
  router.get('/player', asyncHandler(async (req, res) => {
    const p = req.dbPlayer;
    success(res, {
      id: p.id,
      telegram_id: p.telegram_id,
      name: p.name,
      username: p.username,
      role: p.role,
      language_pref: p.language_pref,
      wallet_balance: Number(p.wallet_balance),
      total_tickets_bought: p.total_tickets_bought,
      total_won: Number(p.total_won),
    });
  }));

  // Games
  router.get('/games', asyncHandler(async (req, res) => {
    const games = await gameRoundsRepo.listActive({ limit: 50 });
    success(res, { games: games.map(formatGame) });
  }));

  router.get('/games/:id', asyncHandler(async (req, res) => {
    const game = await getGameDetail(Number(req.params.id));
    success(res, { game: formatGame(game) });
  }));

  router.get('/games/:id/drawn-numbers', asyncHandler(async (req, res) => {
    const numbers = await drawnNumbersRepo.listByGame(Number(req.params.id));
    success(res, { numbers });
  }));

  // Completed games
  router.get('/games/completed/list', asyncHandler(async (req, res) => {
    const result = await gameRoundsRepo.getCompletedWithStats();
    success(res, { games: result.games.map(formatGame) });
  }));

  // Tickets
  router.get('/tickets', asyncHandler(async (req, res) => {
    const result = await ticketsRepo.listByPlayer(req.dbPlayer.id);
    success(res, { tickets: result.tickets });
  }));

  router.get('/tickets/:id', asyncHandler(async (req, res) => {
    const ticket = await ticketsRepo.getById(Number(req.params.id));
    if (!ticket || String(ticket.player_id) !== String(req.dbPlayer.id)) {
      throw new AppError('NOT_FOUND', 404, 'Ticket not found');
    }
    success(res, { ticket });
  }));

  router.post('/tickets', asyncHandler(async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) throw new AppError('MISSING_PARAMS', 400, 'gameId required');
    const result = await buyTicket({ playerId: req.dbPlayer.id, gameRoundId: Number(gameId) });
    success(res, { ticket: result.ticket });
  }));

  // Wallet
  router.get('/wallet', asyncHandler(async (req, res) => {
    const info = await getWalletInfo(req.dbPlayer.id);
    success(res, info);
  }));

  router.post('/wallet/deposit', asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount < 10) throw new AppError('INVALID_AMOUNT', 400, 'Minimum deposit: 10');
    const result = await initiateDeposit({ playerId: req.dbPlayer.id, amount });
    success(res, result);
  }));

  router.post('/wallet/withdraw', asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount) throw new AppError('INVALID_AMOUNT', 400, 'Amount required');
    const result = await requestWithdrawal(req.dbPlayer.id, Number(amount));
    success(res, result);
  }));

  // Language
  router.post('/player/language', asyncHandler(async (req, res) => {
    const { language } = req.body;
    if (!['en', 'am'].includes(language)) {
      throw new AppError('INVALID_LANGUAGE', 400, 'Unsupported language');
    }
    const player = await playersRepo.setLanguage(req.dbPlayer.telegram_id, language);
    success(res, { language: player.language_pref });
  }));

  // History
  router.get('/transactions', asyncHandler(async (req, res) => {
    const result = await transactionsRepo.listByPlayer(req.dbPlayer.id);
    success(res, result);
  }));

  return router;
}

function formatGame(game) {
  if (!game) return null;
  const tiers = typeof game.prize_tiers === 'string' ? JSON.parse(game.prize_tiers) : game.prize_tiers;
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    status: game.status,
    ticket_price: Number(game.ticket_price),
    max_tickets: game.max_tickets,
    max_per_player: game.max_tickets_per_player,
    tickets_sold: game.tickets_sold,
    number_min: game.number_min,
    number_max: game.number_max,
    numbers_per_ticket: game.numbers_per_ticket,
    numbers_to_draw: game.numbers_to_draw,
    prize_pool: Number(game.prize_pool),
    platform_fee: Number(game.platform_fee),
    winner_count: game.winner_count,
    total_payout: Number(game.total_payout),
    prize_tiers: tiers,
    draw_type: game.draw_type,
    scheduled_draw_at: game.scheduled_draw_at,
    drawn_at: game.drawn_at,
    drawn_numbers: game.drawn_numbers || null,
    created_at: game.created_at,
  };
}
