/**
 * WalletSettlement — unified bet/payout settlement logic.
 *
 * Previously duplicated across:
 *   - services/instantGamesService.js  (settleBet)
 *   - services/rouletteService.js      (settleRouletteBet)
 *   - services/gameService.js          (buyTicket — ticket purchase settlement)
 *
 * All instant-game bets (Keno, Spin, Roulette) now flow through this single module.
 * Lottery ticket purchases remain in gameService.js because they use a different
 * table schema (tickets + game_rounds instead of instant_bets).
 */

import { withTransaction } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Settle an instant-game bet atomically.
 *
 * 1. Locks the player row (FOR UPDATE)
 * 2. Validates sufficient balance
 * 3. Deducts stake, credits payout
 * 4. Records the bet in instant_bets
 * 5. Creates transaction ledger entries
 *
 * @param {object} params
 * @param {number}  params.playerId
 * @param {string}  params.gameType    — 'keno' | 'spin' | 'roulette'
 * @param {number}  params.stake       — total stake amount
 * @param {number}  params.payout      — total payout (0 if lost)
 * @param {number}  params.multiplier  — effective multiplier
 * @param {object}  params.outcome     — game-specific outcome data (JSON serializable)
 * @param {string}  [params.notes]     — optional note for the stake transaction
 * @returns {Promise<{betId:number, balance:number}>}
 */
export async function settleBet({ playerId, gameType, stake, payout, multiplier, outcome, notes }) {
  return withTransaction(async (client) => {
    // 1. Lock player
    const { rows: pRows } = await client.query(
      'SELECT wallet_balance FROM players WHERE id = $1 FOR UPDATE',
      [playerId]
    );
    const player = pRows[0];
    if (!player) throw new AppError('PLAYER_NOT_FOUND', 404, 'Player not found');

    const bal0 = Number(player.wallet_balance);
    if (bal0 < stake) throw new AppError('INSUFFICIENT_BALANCE', 402, 'Insufficient balance');

    // 2. Compute balances
    const bal1 = bal0 - stake;            // after stake deduction
    const bal2 = bal1 + payout;           // after payout credit

    // 3. Update player wallet & stats
    await client.query(
      `UPDATE players
         SET wallet_balance = $2,
             total_spent    = total_spent + $3,
             total_won      = total_won + $4
       WHERE id = $1`,
      [playerId, bal2, stake, payout]
    );

    // 4. Record the bet
    const { rows: betRows } = await client.query(
      `INSERT INTO instant_bets (player_id, game_type, stake, payout, multiplier, outcome)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [playerId, gameType, stake, payout, multiplier, JSON.stringify(outcome)]
    );
    const betId = betRows[0].id;

    // 5. Create transaction ledger entries
    const prefix = `${gameType.toUpperCase()}-${betId}`;
    await client.query(
      `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
       VALUES ($1, 'bet', $2, $3, $4, $5, 'completed', $6)`,
      [playerId, stake, bal0, bal1, `${prefix}-B`, notes || `${gameType} stake`]
    );

    if (payout > 0) {
      const winNote = notes ? `${notes} win` : `${gameType} win ${multiplier}x`;
      await client.query(
        `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
         VALUES ($1, 'payout', $2, $3, $4, $5, 'completed', $6)`,
        [playerId, payout, bal1, bal2, `${prefix}-P`, winNote]
      );
    }

    return { betId, balance: bal2 };
  });
}
