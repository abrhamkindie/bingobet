/**
 * LotteryPlugin — Lottery/Bingo draw game.
 *
 * Unlike instant games (Keno, Spin, Roulette), Lottery is round-based:
 *   - Admin creates game rounds
 *   - Players buy tickets with auto-generated random numbers
 *   - Scheduled or manual draws via PostgreSQL functions
 *
 * This plugin wraps the existing gameRoundsRepo, ticketsRepo, drawnNumbersRepo,
 * and gameService logic without changing the database schema.
 */

import { GamePlugin } from '../GamePlugin.js';
import { GameEngine } from '../GameEngine.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { query, withTransaction } from '../../db/index.js';
import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import * as ticketsRepo from '../../db/repositories/tickets.js';
import * as playersRepo from '../../db/repositories/players.js';
import * as drawnNumbersRepo from '../../db/repositories/drawnNumbers.js';
import { generateConfirmationCode } from '../../utils/code.js';

export class LotteryPlugin extends GamePlugin {
  constructor() {
    super({
      id: 'lottery',
      label: 'Lottery',
      description: 'Buy tickets with random numbers and match the draw to win',
      metadata: {
        type: 'round',
      },
    });

    /** @type {import('../fsm/StateMachine.js').StateMachine} */
    this.fsm = null;
  }

  /** @override */
  async init(engine) {
    await super.init(engine);

    // Create shared lifecycle FSM for lottery rounds
    this.fsm = GameEngine.createLifecycleFSM('lottery');
  }

  // ── Admin / internal operations ────────────────────────

  /**
   * Create a new lottery game round.
   * @param {object} data — same shape as gameRoundsRepo.create()
   * @returns {Promise<object>}
   */
  async createRound(data) {
    const game = await gameRoundsRepo.create(data);
    logger.info('Lottery round created', { gameId: game.id, title: game.title });
    return game;
  }

  /**
   * List active lottery rounds.
   * @returns {Promise<object[]>}
   */
  async listActiveGames() {
    return gameRoundsRepo.listActive();
  }

  /**
   * List all lottery rounds (admin).
   * @returns {Promise<object[]>}
   */
  async listAllGames(opts = {}) {
    return gameRoundsRepo.listAll(opts);
  }

  /**
   * Get a game round by id.
   */
  async getGame(gameId) {
    const game = await gameRoundsRepo.getById(gameId);
    if (!game) throw new AppError('GAME_NOT_FOUND', 404, 'Game not found');
    return game;
  }

  /**
   * Start the draw for a game round.
   * @param {number} gameRoundId
   * @returns {Promise<object>}
   */
  async startDraw(gameRoundId) {
    const game = await gameRoundsRepo.getById(gameRoundId);
    if (!game) throw new AppError('GAME_NOT_FOUND', 404, 'Game not found');
    if (game.status !== 'active') throw new AppError('GAME_NOT_DRAWABLE', 409, 'Game cannot be drawn in its current state');

    await gameRoundsRepo.updateStatus(gameRoundId, 'drawing');

    // Run the draw via the PostgreSQL function
    const { rows } = await query('SELECT complete_game_draw($1) AS result', [gameRoundId]);
    const result = rows[0]?.result;

    logger.info('Lottery draw completed', { gameRoundId, result });
    return result;
  }

  // ── Player operations ──────────────────────────────────

  /** @override */
  async play(playerId, input) {
    // Lottery's "play" is a ticket purchase
    const { gameRoundId } = input;
    if (!gameRoundId) throw new AppError('INVALID_INPUT', 422, 'gameRoundId is required');

    return this.buyTicket({ playerId, gameRoundId });
  }

  /**
   * Buy a ticket for a lottery round.
   */
  async buyTicket({ playerId, gameRoundId }) {
    const game = await gameRoundsRepo.getById(gameRoundId);
    if (!game) throw new AppError('GAME_NOT_FOUND', 404, 'Game not found');

    if (game.status !== 'upcoming' && game.status !== 'active') {
      throw new AppError('GAME_NOT_ACCEPTING_TICKETS', 409, 'Game is not accepting tickets');
    }

    if (game.tickets_sold >= game.max_tickets) {
      throw new AppError('GAME_SOLD_OUT', 409, 'Game is sold out');
    }

    const player = await playersRepo.getById(playerId);
    if (!player) throw new AppError('PLAYER_NOT_FOUND', 404, 'Player not found');

    if (player.wallet_balance < Number(game.ticket_price)) {
      throw new AppError('INSUFFICIENT_BALANCE', 402, 'Insufficient balance');
    }

    // Check player ticket limit
    const playerTickets = await ticketsRepo.listByGameAndPlayer(gameRoundId, playerId);
    if (playerTickets.length >= game.max_tickets_per_player) {
      throw new AppError('PLAYER_TICKET_LIMIT_REACHED', 409, 'Ticket limit reached');
    }

    const result = await withTransaction(async (client) => {
      // Create ticket using SQL function
      const { rows } = await client.query(
        'SELECT buy_ticket($1, $2) AS id',
        [playerId, gameRoundId]
      );
      const ticketId = rows[0].id;

      // Get the ticket with numbers
      const { rows: ticketRows } = await client.query(
        'SELECT * FROM tickets WHERE id = $1', [ticketId]
      );
      const ticket = ticketRows[0];

      // Get player balance after deduction
      const { rows: playerRows } = await client.query(
        'SELECT * FROM players WHERE id = $1', [playerId]
      );
      const updatedPlayer = playerRows[0];

      // Record transaction
      const ref = generateConfirmationCode();
      await client.query(
        `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after,
           reference, status, ticket_id, game_round_id)
         VALUES ($1, 'ticket_purchase', $2, $3, $4, $5, 'completed', $6, $7)`,
        [playerId, game.ticket_price, player.wallet_balance, updatedPlayer.wallet_balance,
         ref, ticketId, gameRoundId]
      );

      return {
        ticket: {
          ...ticket,
          game_title: game.title,
          scheduled_draw_at: game.scheduled_draw_at,
          numbers_to_draw: game.numbers_to_draw,
        },
      };
    });

    logger.info('Lottery ticket purchased', { ticketId: result.ticket.id, playerId, gameRoundId });
    return result;
  }

  /**
   * Get player's tickets for a specific game.
   */
  async getPlayerTickets(playerId, gameRoundId) {
    return ticketsRepo.listByGameAndPlayer(gameRoundId, playerId);
  }

  /**
   * Get all tickets for a player.
   */
  async getMyTickets(playerId) {
    return ticketsRepo.listByPlayer(playerId);
  }

  /**
   * Get a ticket by id.
   */
  async getTicket(ticketId) {
    return ticketsRepo.getById(ticketId);
  }

  // ── Draw data ──────────────────────────────────────────

  /**
   * Get drawn numbers for a game round.
   */
  async getDrawnNumbers(gameRoundId) {
    return drawnNumbersRepo.listByGame(gameRoundId);
  }

  /**
   * Get completed draws with stats.
   */
  async getCompletedDraws() {
    return gameRoundsRepo.getCompletedWithStats();
  }

  /**
   * Get scheduled draws that are due.
   */
  async getScheduledDrawsDue() {
    return gameRoundsRepo.getScheduledDrawsDue();
  }

  /** @override */
  async getConfig() {
    // Lottery config is per-round, returned by getGame()
    return {};
  }
}
