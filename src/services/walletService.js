import * as playersRepo from '../db/repositories/players.js';
import * as transactionsRepo from '../db/repositories/transactions.js';
import { initializePayment, verifyPayment } from './chapaService.js';
import { query, withTransaction } from '../db/index.js';
import { generateTxRef } from '../utils/code.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const SUCCESS_GATEWAY_STATUSES = new Set(['success', 'paid', 'completed']);
const FAILED_GATEWAY_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'expired']);

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

// Initiate a deposit via Chapa
export async function initiateDeposit({ playerId, amount, returnUrl, callbackUrl }) {
  if (amount < 10) throw new Error('INVALID_AMOUNT');

  const player = await playersRepo.getById(playerId);
  if (!player) throw new Error('PLAYER_NOT_FOUND');

  const chapaResult = await initializePayment({
    amount: Number(amount),
    currency: 'ETB',
    entityId: playerId,
    entityType: 'deposit',
    customerEmail: `${player.username || player.id}@gmail.com`,
    customerPhone: player.phone,
    callbackUrl: callbackUrl || `${config.publicUrl}/api/payments/chapa/webhook`,
    returnUrl: returnUrl || `https://t.me/${config.botUsername}`,
  });

  const tx = await transactionsRepo.create({
    playerId,
    type: 'deposit',
    amount: Number(amount),
    balanceBefore: player.wallet_balance,
    balanceAfter: player.wallet_balance,
    reference: chapaResult.tx_ref,
    status: 'pending',
    chapaTxRef: chapaResult.tx_ref,
    chapaCheckoutUrl: chapaResult.checkout_url,
  });

  return { transaction: tx, checkoutUrl: chapaResult.checkout_url };
}

// Confirm a deposit after Chapa payment
export async function confirmDeposit(chapaTxRef) {
  const tx = await transactionsRepo.getByChapaTxRef(chapaTxRef);
  if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
  if (tx.status === 'completed') return { transaction: tx, player: await playersRepo.getById(tx.player_id) };

  const verification = await verifyPayment(chapaTxRef);
  const gatewayStatus = normalizeStatus(verification.status);

  if (SUCCESS_GATEWAY_STATUSES.has(gatewayStatus)) {
    return withTransaction(async (client) => {
      // Update transaction
      await client.query(
        `UPDATE transactions SET status = 'completed', raw = $2, updated_at = now()
         WHERE id = $1 AND status = 'pending'`,
        [tx.id, JSON.stringify(verification.data)]
      );

      // Credit player wallet
      const { rows } = await client.query(
        `UPDATE players SET wallet_balance = wallet_balance + $2 WHERE id = $1 RETURNING *`,
        [tx.player_id, tx.amount]
      );
      const player = rows[0];

      // Update balance in transaction
      await client.query(
        `UPDATE transactions SET balance_after = $2 WHERE id = $1`,
        [tx.id, player.wallet_balance]
      );

      // Create deposit receipt reference
      const ref = 'DEP-' + Date.now().toString(36).toUpperCase();
      await client.query(
        `UPDATE transactions SET reference = $2 WHERE id = $1 AND reference IS NULL`,
        [tx.id, ref]
      );

      const updatedTx = await transactionsRepo.getById(tx.id);
      return { transaction: updatedTx, player };
    });
  }

  if (FAILED_GATEWAY_STATUSES.has(gatewayStatus)) {
    await transactionsRepo.updateStatus(tx.id, 'failed', verification.data);
    throw new Error('PAYMENT_FAILED');
  }

  return { transaction: tx, player: await playersRepo.getById(tx.player_id) };
}

// Request a withdrawal
export async function requestWithdrawal(playerId, amount) {
  if (amount <= 0) throw new Error('INVALID_AMOUNT');

  const { rows } = await query('SELECT min_withdrawal FROM settings WHERE key = $1', ['min_withdrawal']);
  const minWithdrawal = Number(rows[0]?.value || 50);

  if (amount < minWithdrawal) throw new Error('WITHDRAWAL_MINIMUM');

  const player = await playersRepo.getById(playerId);
  if (!player) throw new Error('PLAYER_NOT_FOUND');
  if (player.wallet_balance < amount) throw new Error('INSUFFICIENT_BALANCE');

  const result = await withTransaction(async (client) => {
    const { rows: updated } = await client.query(
      `UPDATE players SET wallet_balance = wallet_balance - $2 WHERE id = $1 AND wallet_balance >= $2 RETURNING *`,
      [playerId, amount]
    );
    if (!updated.length) throw new Error('INSUFFICIENT_BALANCE');

    const player = updated[0];
    const ref = 'WD-' + Date.now().toString(36).toUpperCase();
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
       VALUES ($1, 'withdrawal', $2, $3, $4, $5, 'pending', 'Withdrawal request')
       RETURNING *`,
      [playerId, amount, player.wallet_balance + amount, player.wallet_balance, ref]
    );
    return { transaction: txRows[0], player };
  });

  return result;
}

// Get wallet info for a player
export async function getWalletInfo(playerId) {
  const player = await playersRepo.getById(playerId);
  if (!player) throw new Error('PLAYER_NOT_FOUND');

  const { transactions } = await transactionsRepo.listByPlayer(playerId, { limit: 10 });
  return {
    balance: player.wallet_balance,
    totalSpent: player.total_spent,
    totalWon: player.total_won,
    transactions,
  };
}
