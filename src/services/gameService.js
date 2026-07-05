import * as gameRoundsRepo from '../db/repositories/gameRounds.js';
import * as ticketsRepo from '../db/repositories/tickets.js';
import * as transactionsRepo from '../db/repositories/transactions.js';
import * as playersRepo from '../db/repositories/players.js';
import { query, withTransaction } from '../db/index.js';
import { generateConfirmationCode } from '../utils/code.js';
import { logger } from '../utils/logger.js';

export class GameError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Create a new game round
export async function createGame(gameData) {
  const game = await gameRoundsRepo.create(gameData);
  logger.info('Game round created', { gameId: game.id, title: game.title });
  return game;
}

// Buy a ticket for a game
export async function buyTicket({ playerId, gameRoundId }) {
  const game = await gameRoundsRepo.getById(gameRoundId);
  if (!game) throw new GameError('GAME_NOT_FOUND');
  
  if (game.status !== 'upcoming' && game.status !== 'active') {
    throw new GameError('GAME_NOT_ACCEPTING_TICKETS');
  }

  if (game.tickets_sold >= game.max_tickets) {
    throw new GameError('GAME_SOLD_OUT');
  }

  const player = await playersRepo.getById(playerId);
  if (!player) throw new GameError('PLAYER_NOT_FOUND');

  if (player.wallet_balance < Number(game.ticket_price)) {
    throw new GameError('INSUFFICIENT_BALANCE');
  }

  // Check player ticket limit
  const playerTickets = await ticketsRepo.listByGameAndPlayer(gameRoundId, playerId);
  if (playerTickets.length >= game.max_tickets_per_player) {
    throw new GameError('PLAYER_TICKET_LIMIT_REACHED');
  }

  const result = await withTransaction(async (client) => {
    // Create ticket using the SQL function
    const { rows } = await client.query(
      `SELECT buy_ticket($1, $2) AS id`,
      [playerId, gameRoundId]
    );
    const ticketId = rows[0].id;

    // Get the ticket with numbers
    const { rows: ticketRows } = await client.query(
      `SELECT * FROM tickets WHERE id = $1`, [ticketId]
    );
    const ticket = ticketRows[0];

    // Get player balance after deduction
    const { rows: playerRows } = await client.query(
      `SELECT * FROM players WHERE id = $1`, [playerId]
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

    return { ticket: { ...ticket, game_title: game.title, scheduled_draw_at: game.scheduled_draw_at, numbers_to_draw: game.numbers_to_draw } };
  });

  logger.info('Ticket purchased', { ticketId: result.ticket.id, playerId, gameRoundId });
  return result;
}

// Get active games
export async function listActiveGames() {
  return gameRoundsRepo.listActive();
}

// Get game detail
export async function getGameDetail(gameId) {
  const game = await gameRoundsRepo.getById(gameId);
  if (!game) throw new GameError('GAME_NOT_FOUND');
  return game;
}

// Get player tickets for a game
export async function getPlayerTickets(playerId, gameRoundId) {
  return ticketsRepo.listByGameAndPlayer(gameRoundId, playerId);
}

// Get all player tickets
export async function getMyTickets(playerId) {
  return ticketsRepo.listByPlayer(playerId);
}

// Start the draw for a game
export async function startDraw(gameRoundId) {
  const game = await gameRoundsRepo.getById(gameRoundId);
  if (!game) throw new GameError('GAME_NOT_FOUND');
  if (game.status !== 'active') throw new GameError('GAME_NOT_DRAWABLE');

  await gameRoundsRepo.updateStatus(gameRoundId, 'drawing');

  // Run the draw
  const { rows } = await query(
    `SELECT complete_game_draw($1) AS result`, [gameRoundId]
  );
  const result = rows[0]?.result;

  logger.info('Game draw completed', { gameRoundId, result });
  return result;
}
