import { query } from '../index.js';

export async function listByGame(gameRoundId) {
  const { rows } = await query(
    `SELECT * FROM drawn_numbers
     WHERE game_round_id = $1
     ORDER BY position ASC`,
    [gameRoundId]
  );
  return rows;
}

export async function getLastDrawn(gameRoundId) {
  const { rows } = await query(
    `SELECT * FROM drawn_numbers
     WHERE game_round_id = $1
     ORDER BY position DESC
     LIMIT 1`,
    [gameRoundId]
  );
  return rows[0] || null;
}

export async function drawNumbers(gameRoundId, count) {
  const { rows } = await query(
    `SELECT * FROM draw_random_numbers($1, $2)`,
    [gameRoundId, count]
  );
  return rows;
}

export async function countByGame(gameRoundId) {
  const { rows } = await query(
    'SELECT COUNT(*) FROM drawn_numbers WHERE game_round_id = $1',
    [gameRoundId]
  );
  return parseInt(rows[0].count, 10);
}

export async function getDrawnNumbersArray(gameRoundId) {
  const { rows } = await query(
    `SELECT array_agg(number ORDER BY position) AS numbers
     FROM drawn_numbers WHERE game_round_id = $1`,
    [gameRoundId]
  );
  return rows[0]?.numbers || [];
}
