import { query } from '../index.js';

export async function create({ playerId, gameRoundId }) {
  const { rows } = await query(
    `SELECT buy_ticket($1, $2) AS id`,
    [playerId, gameRoundId]
  );
  const ticketId = rows[0].id;
  return getById(ticketId);
}

export async function getById(id) {
  const { rows } = await query(
    `SELECT t.*, gr.title AS game_title, gr.status AS game_status,
            gr.numbers_to_draw, gr.scheduled_draw_at, gr.ticket_price,
            gr.prize_tiers, gr.prize_pool, gr.number_min, gr.number_max
     FROM tickets t
     JOIN game_rounds gr ON gr.id = t.game_round_id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function listByPlayer(playerId, { limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT t.*, gr.title AS game_title, gr.status AS game_status,
            gr.numbers_to_draw, gr.scheduled_draw_at, gr.ticket_price,
            gr.prize_pool, gr.number_min, gr.number_max
     FROM tickets t
     JOIN game_rounds gr ON gr.id = t.game_round_id
     WHERE t.player_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [playerId, limit, offset]
  );
  const { rows: countRows } = await query(
    'SELECT COUNT(*) FROM tickets WHERE player_id = $1',
    [playerId]
  );
  return { tickets: rows, total: parseInt(countRows[0].count, 10) };
}

export async function listByGame(gameRoundId) {
  const { rows } = await query(
    `SELECT t.*, p.name AS player_name, p.username AS player_username
     FROM tickets t
     JOIN players p ON p.id = t.player_id
     WHERE t.game_round_id = $1
     ORDER BY t.position ASC`,
    [gameRoundId]
  );
  return rows;
}

export async function listByGameAndPlayer(gameRoundId, playerId) {
  const { rows } = await query(
    `SELECT t.*, gr.title AS game_title, gr.numbers_to_draw,
            gr.prize_pool, gr.prize_tiers
     FROM tickets t
     JOIN game_rounds gr ON gr.id = t.game_round_id
     WHERE t.game_round_id = $1 AND t.player_id = $2
     ORDER BY t.position ASC`,
    [gameRoundId, playerId]
  );
  return rows;
}

export async function countByGame(gameRoundId) {
  const { rows } = await query(
    'SELECT COUNT(*) FROM tickets WHERE game_round_id = $1',
    [gameRoundId]
  );
  return parseInt(rows[0].count, 10);
}
