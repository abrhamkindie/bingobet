import { query } from '../index.js';

/**
 * Read a setting value (settings.value is JSONB, auto-parsed by pg).
 * Returns `fallback` when the key is missing.
 */
export async function get(key, fallback = null) {
  const { rows } = await query('SELECT value FROM settings WHERE key = $1', [key]);
  if (!rows.length) return fallback;
  return rows[0].value;
}

/** Read a numeric setting, coercing strings/JSON numbers safely. */
export async function getNumber(key, fallback = 0) {
  const v = await get(key, null);
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function set(key, value) {
  const { rows } = await query(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING *`,
    [key, JSON.stringify(value)]
  );
  return rows[0];
}
