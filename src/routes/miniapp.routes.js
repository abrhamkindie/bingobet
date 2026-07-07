import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { telegramAuth } from '../middlewares/telegramAuth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { success } from '../utils/apiResponse.js';
import { AppError, ValidationError } from '../utils/errors.js';
import { config } from '../config/index.js';

import * as gameRoundsRepo from '../db/repositories/gameRounds.js';
import * as ticketsRepo from '../db/repositories/tickets.js';
import * as drawnNumbersRepo from '../db/repositories/drawnNumbers.js';
import * as playersRepo from '../db/repositories/players.js';
import * as transactionsRepo from '../db/repositories/transactions.js';

import { buyTicket, getGameDetail } from '../services/gameService.js';
import { getWalletInfo, initiateDeposit, requestWithdrawal } from '../services/walletService.js';
import {
  playKeno, playSpin, getInstantConfig, getInstantHistory,
} from '../services/instantGamesService.js';
import { playRoulette, getAllBetTypes, getBetGroups, getSectorColors } from '../services/rouletteService.js';
import {
  getDailyStatus, claimDaily, getReferralInfo, ensureReferralCode,
  captureReferral, getLeaderboard,
} from '../services/rewardsService.js';

// ── Validation helper ───────────────────────────────────
function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Invalid request', details);
  }
  return result.data;
}

const depositSchema = z.object({ amount: z.coerce.number().positive().max(1_000_000) });
const withdrawSchema = z.object({ amount: z.coerce.number().positive().max(1_000_000) });
const buySchema = z.object({ gameId: z.coerce.number().int().positive() });
const languageSchema = z.object({ language: z.enum(['en', 'am']) });
const kenoSchema = z.object({
  stake: z.coerce.number().positive().max(1_000_000),
  picks: z.array(z.coerce.number().int().positive()).min(1).max(20),
});
const spinSchema = z.object({ stake: z.coerce.number().positive().max(1_000_000) });
const rouletteSchema = z.object({
  bets: z.array(z.string()).min(1).max(60),
  stakePerBet: z.coerce.number().positive().max(1_000_000),
});

// Tighter limiter for state-changing money/ticket actions (skipped in dev).
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'development',
  // Key by authenticated player id (telegramAuth always runs first), so we never
  // touch req.ip — avoids the express-rate-limit IPv6 keyGenerator error.
  keyGenerator: (req) => `u:${req.dbPlayer?.id || 'anon'}`,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, slow down.' } },
});

export function createMiniAppRouter() {
  const router = Router();
  router.use(telegramAuth());

  // ── Player profile (D1: now includes total_spent + daily + referral) ──
  router.get('/player', asyncHandler(async (req, res) => {
    const p = req.dbPlayer;

    // Referral attribution + code allocation on first load.
    const startParam = req.query.start_param || null;
    if (startParam) {
      await captureReferral({ player: p, startParam, isNew: !!p.is_new }).catch(() => {});
    }
    const referralCode = await ensureReferralCode(p).catch(() => null);
    const daily = await getDailyStatus(p).catch(() => null);

    success(res, {
      id: p.id,
      telegram_id: p.telegram_id,
      name: p.name,
      username: p.username,
      role: p.role,
      language_pref: p.language_pref,
      wallet_balance: Number(p.wallet_balance),
      total_tickets_bought: p.total_tickets_bought,
      total_spent: Number(p.total_spent || 0),
      total_won: Number(p.total_won || 0),
      referral_code: referralCode,
      referral_count: p.referral_count || 0,
      daily,
    });
  }));

  // ── Games ──
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

  router.get('/games/completed/list', asyncHandler(async (req, res) => {
    const result = await gameRoundsRepo.getCompletedWithStats();
    success(res, { games: result.games.map(formatGame) });
  }));

  // ── Instant games (Keno + Spin) ──
  router.get('/games/instant/config', asyncHandler(async (req, res) => {
    const cfg = await getInstantConfig();
    success(res, cfg);
  }));

  router.get('/games/instant/history', asyncHandler(async (req, res) => {
    const gameType = req.query.game_type || null;
    const history = await getInstantHistory(req.dbPlayer.id, { gameType });
    success(res, history);
  }));

  router.post('/games/keno/play', writeLimiter, asyncHandler(async (req, res) => {
    const { stake, picks } = parseBody(kenoSchema, req.body);
    const result = await playKeno({ playerId: req.dbPlayer.id, stake, picks });
    success(res, result);
  }));

  router.post('/games/spin/play', writeLimiter, asyncHandler(async (req, res) => {
    const { stake } = parseBody(spinSchema, req.body);
    const result = await playSpin({ playerId: req.dbPlayer.id, stake });
    success(res, result);
  }));

  // ── Roulette ──
  router.get('/games/roulette/bet-types', asyncHandler(async (req, res) => {
    const types = getAllBetTypes();
    const groups = getBetGroups();
    const sectorColors = getSectorColors();
    success(res, { types, groups, sectorColors });
  }));

  router.post('/games/roulette/play', writeLimiter, asyncHandler(async (req, res) => {
    const { bets, stakePerBet } = parseBody(rouletteSchema, req.body);
    const result = await playRoulette({ playerId: req.dbPlayer.id, bets, stakePerBet });
    success(res, result);
  }));

  // ── Tickets ──
  router.get('/tickets', asyncHandler(async (req, res) => {
    const result = await ticketsRepo.listByPlayer(req.dbPlayer.id);
    success(res, { tickets: result.tickets });
  }));

  router.get('/tickets/:id', asyncHandler(async (req, res) => {
    const ticket = await ticketsRepo.getById(Number(req.params.id));
    if (!ticket || String(ticket.player_id) !== String(req.dbPlayer.id)) {
      throw new AppError('NOT_FOUND', 404, 'Ticket not found');
    }
    // Attach drawn numbers so the detail sheet can highlight matches.
    let drawn = [];
    try { drawn = await drawnNumbersRepo.listByGame(ticket.game_round_id); } catch { /* ignore */ }
    success(res, { ticket: { ...ticket, drawn_numbers: drawn } });
  }));

  router.post('/tickets', writeLimiter, asyncHandler(async (req, res) => {
    const { gameId } = parseBody(buySchema, req.body);
    const result = await buyTicket({ playerId: req.dbPlayer.id, gameRoundId: gameId });
    success(res, { ticket: result.ticket });
  }));

  // ── Wallet ──
  router.get('/wallet', asyncHandler(async (req, res) => {
    const info = await getWalletInfo(req.dbPlayer.id);
    success(res, info);
  }));

  router.post('/wallet/deposit', writeLimiter, asyncHandler(async (req, res) => {
    const { amount } = parseBody(depositSchema, req.body);
    if (amount < 10) throw new AppError('INVALID_AMOUNT', 422, 'Minimum deposit is 10 ETB');
    const result = await initiateDeposit({ playerId: req.dbPlayer.id, amount });
    success(res, result);
  }));

  router.post('/wallet/withdraw', writeLimiter, asyncHandler(async (req, res) => {
    const { amount } = parseBody(withdrawSchema, req.body);
    const result = await requestWithdrawal(req.dbPlayer.id, amount);
    success(res, result);
  }));

  // ── Daily reward ──
  router.get('/player/daily', asyncHandler(async (req, res) => {
    const status = await getDailyStatus(req.dbPlayer);
    success(res, status);
  }));

  router.post('/player/daily/claim', writeLimiter, asyncHandler(async (req, res) => {
    const result = await claimDaily(req.dbPlayer.id);
    success(res, result);
  }));

  // ── Referrals ──
  router.get('/player/referrals', asyncHandler(async (req, res) => {
    const info = await getReferralInfo(req.dbPlayer);
    success(res, info);
  }));

  // ── Leaderboard ──
  router.get('/leaderboard', asyncHandler(async (req, res) => {
    const period = req.query.period === 'week' ? 'week' : 'all';
    const data = await getLeaderboard(period, req.dbPlayer.id);
    success(res, data);
  }));

  // ── Language ──
  router.post('/player/language', asyncHandler(async (req, res) => {
    const { language } = parseBody(languageSchema, req.body);
    const player = await playersRepo.setLanguage(req.dbPlayer.telegram_id, language);
    success(res, { language: player.language_pref });
  }));

  // ── Transaction history ──
  router.get('/transactions', asyncHandler(async (req, res) => {
    const result = await transactionsRepo.listByPlayer(req.dbPlayer.id, { limit: 50 });
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
