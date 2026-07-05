import { query } from '../index.js';

export async function upsertPlayer({ telegramId, name, username }) {
  const { rows } = await query(
    `INSERT INTO players (telegram_id, name, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, players.name),
           username = COALESCE(EXCLUDED.username, players.username)
     RETURNING *, (xmax = 0) AS is_new`,
    [telegramId, name || null, username || null]
  );
  return rows[0];
}

export async function getByTelegramId(telegramId) {
  const { rows } = await query('SELECT * FROM players WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

export async function getById(id) {
  const { rows } = await query('SELECT * FROM players WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function setLanguage(telegramId, lang) {
  const { rows } = await query(
    'UPDATE players SET language_pref = $2 WHERE telegram_id = $1 RETURNING *',
    [telegramId, lang]
  );
  return rows[0];
}

export async function setRole(telegramId, role) {
  const { rows } = await query(
    'UPDATE players SET role = $2 WHERE telegram_id = $1 RETURNING *',
    [telegramId, role]
  );
  return rows[0];
}

export async function listAdmins() {
  const { rows } = await query(
    "SELECT id, telegram_id, name, username, language_pref FROM players WHERE role = 'admin' AND is_banned = false ORDER BY id ASC"
  );
  return rows;
}

export async function updateBalance(playerId, delta) {
  const { rows } = await query(
    `UPDATE players SET wallet_balance = wallet_balance + $2
     WHERE id = $1 AND wallet_balance + $2 >= 0
     RETURNING *`,
    [playerId, delta]
  );
  return rows[0] || null;
}

export async function listAll({ limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT p.*, (SELECT COUNT(*) FROM tickets WHERE player_id = p.id) AS ticket_count
     FROM players p
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query('SELECT COUNT(*) FROM players');
  return { players: rows, total: parseInt(countRows[0].count, 10) };
}

export async function ban(id, reason = null) {
  const { rows } = await query(
    'UPDATE players SET is_banned = true, ban_reason = $2 WHERE id = $1 RETURNING *',
    [id, reason]
  );
  return rows[0] || null;
}

export async function unban(id) {
  const { rows } = await query(
    "UPDATE players SET is_banned = false, ban_reason = NULL WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0] || null;
}
