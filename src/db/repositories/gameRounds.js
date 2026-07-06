import { query } from '../index.js';

export async function create({
  title,
  description,
  ticketPrice,
  maxTickets = 1000,
  maxPerPlayer = 10,
  numberMin = 1,
  numberMax = 50,
  numbersPerTicket = 6,
  numbersToDraw = 6,
  drawType = 'scheduled',
  scheduledDrawAt = null,
  drawIntervalMinutes = null,
  platformFeePercent = 10,
  prizeTiers = null,
  createdBy = null,
}) {
  const defaultTiers = JSON.stringify([
    { match: 3, payout_multiplier: 2, label: 'Match 3 - 2x' },
    { match: 4, payout_multiplier: 10, label: 'Match 4 - 10x' },
    { match: 5, payout_multiplier: 50, label: 'Match 5 - 50x' },
    { match: 6, payout_multiplier: 0, label: 'JACKPOT!', is_jackpot: true },
  ]);

  const tiers = prizeTiers || defaultTiers;

  const { rows } = await query(
    `INSERT INTO game_rounds
       (title, description, ticket_price, max_tickets, max_tickets_per_player,
        number_min, number_max, numbers_per_ticket, numbers_to_draw,
        draw_type, scheduled_draw_at, draw_interval_minutes,
        platform_fee_percent, prize_tiers, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       CASE WHEN $11 IS NOT NULL AND $11 > now() THEN 'upcoming' ELSE 'active' END)
     RETURNING *`,
    [
      title, description || '', ticketPrice, maxTickets, maxPerPlayer,
      numberMin, numberMax, numbersPerTicket, numbersToDraw,
      drawType, scheduledDrawAt, drawIntervalMinutes,
      platformFeePercent, typeof tiers === 'string' ? tiers : JSON.stringify(tiers), createdBy,
    ]
  );
  return rows[0];
}

export async function getById(id) {
  const { rows } = await query('SELECT * FROM game_rounds WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listActive({ limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT * FROM game_rounds
     WHERE status IN ('upcoming', 'active')
     ORDER BY
       CASE status WHEN 'active' THEN 0 ELSE 1 END,
       scheduled_draw_at ASC NULLS LAST,
       created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function listAll({ status = null, limit = 20, offset = 0 } = {}) {
  let where = '';
  const params = [];
  let idx = 1;

  if (status) {
    where = `WHERE status = $${idx++}`;
    params.push(status);
  }

  params.push(limit, offset);

  const { rows } = await query(
    `SELECT * FROM game_rounds ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  const countParams = status ? [status] : [];
  const countWhere = status ? `WHERE status = $1` : '';
  const { rows: countRows } = await query(`SELECT COUNT(*) FROM game_rounds ${countWhere}`, countParams);
  return { games: rows, total: parseInt(countRows[0].count, 10) };
}

export async function updateStatus(id, status) {
  const { rows } = await query(
    `UPDATE game_rounds SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

export async function getScheduledDrawsDue() {
  const { rows } = await query(
    `SELECT * FROM game_rounds
     WHERE status = 'active'
       AND draw_type = 'scheduled'
       AND scheduled_draw_at <= now()
     ORDER BY scheduled_draw_at ASC`
  );
  return rows;
}

export async function getCompletedWithStats({ limit = 20, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT gr.*,
            COALESCE(
              array_agg(dn.number ORDER BY dn.position) FILTER (WHERE dn.number IS NOT NULL),
              '{}'
            ) AS drawn_numbers
     FROM game_rounds gr
     LEFT JOIN drawn_numbers dn ON dn.game_round_id = gr.id
     WHERE gr.status = 'completed'
     GROUP BY gr.id
     ORDER BY gr.drawn_at DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query("SELECT COUNT(*) FROM game_rounds WHERE status = 'completed'");
  return { games: rows, total: parseInt(countRows[0].count, 10) };
}
