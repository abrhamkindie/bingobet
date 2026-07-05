import { query } from '../index.js';

export async function create({
  playerId,
  type,
  amount,
  balanceBefore,
  balanceAfter,
  reference = null,
  status = 'pending',
  ticketId = null,
  gameRoundId = null,
  chapaTxRef = null,
  chapaCheckoutUrl = null,
  notes = null,
}) {
  const { rows } = await query(
    `INSERT INTO transactions
       (player_id, type, amount, balance_before, balance_after,
        reference, status, ticket_id, game_round_id,
        chapa_tx_ref, chapa_checkout_url, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      playerId, type, amount, balanceBefore, balanceAfter,
      reference, status, ticketId, gameRoundId,
      chapaTxRef, chapaCheckoutUrl, notes,
    ]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getByReference(reference) {
  const { rows } = await query('SELECT * FROM transactions WHERE reference = $1', [reference]);
  return rows[0] || null;
}

export async function getByChapaTxRef(chapaTxRef) {
  const { rows } = await query('SELECT * FROM transactions WHERE chapa_tx_ref = $1', [chapaTxRef]);
  return rows[0] || null;
}

export async function listByPlayer(playerId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT t.*, gr.title AS game_title
     FROM transactions t
     LEFT JOIN game_rounds gr ON gr.id = t.game_round_id
     WHERE t.player_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [playerId, limit, offset]
  );
  const { rows: countRows } = await query(
    'SELECT COUNT(*) FROM transactions WHERE player_id = $1',
    [playerId]
  );
  return { transactions: rows, total: parseInt(countRows[0].count, 10) };
}

export async function updateStatus(id, status, raw = null) {
  const { rows } = await query(
    `UPDATE transactions SET status = $2,
         raw = COALESCE($3, raw),
         updated_at = now()
     WHERE id = $1 AND status IN ('pending')
     RETURNING *`,
    [id, status, raw ? JSON.stringify(raw) : null]
  );
  return rows[0] || null;
}

export async function updateChapa(id, { chapaTxRef, chapaCheckoutUrl }) {
  const { rows } = await query(
    `UPDATE transactions SET
       chapa_tx_ref = COALESCE($2, chapa_tx_ref),
       chapa_checkout_url = COALESCE($3, chapa_checkout_url)
     WHERE id = $1
     RETURNING *`,
    [id, chapaTxRef, chapaCheckoutUrl]
  );
  return rows[0] || null;
}

export async function listAll({ type = null, status = null, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (type) { conditions.push(`type = $${idx++}`); params.push(type); }
  if (status) { conditions.push(`status = $${idx++}`); params.push(status); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT t.*, p.name AS player_name, p.telegram_id AS player_telegram_id
     FROM transactions t
     JOIN players p ON p.id = t.player_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  const countParams = [];
  let countIdx = 1;
  if (type) { countParams.push(type); }
  if (status) { countParams.push(status); }
  const countWhere = conditions.length ? 'WHERE ' + conditions.map(() => `$${countIdx++}`).join(' AND ') : '';
  
  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM transactions ${countWhere}`,
    countParams
  );

  return { transactions: rows, total: parseInt(countRows[0].count, 10) };
}
