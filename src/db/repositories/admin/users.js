import { query } from '../../index.js';

// List all users with pagination and filters.
export async function listAll({ role, isBanned, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (role) {
    conditions.push(`role = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  if (isBanned !== undefined) {
    conditions.push(`is_banned = $${paramIndex}`);
    params.push(isBanned);
    paramIndex++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: users } = await query(
    `SELECT id, telegram_id, name, username, phone, role, language_pref, is_banned, ban_reason, created_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const { rows: count } = await query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    params
  );

  return {
    users,
    total: parseInt(count[0].count, 10),
  };
}

// Get user details with booking statistics.
export async function getById(id) {
  const { rows } = await query(
    `SELECT u.*,
            (SELECT COUNT(*) FROM bookings WHERE driver_id = u.id) AS total_bookings,
            (SELECT COUNT(*) FROM bookings WHERE driver_id = u.id AND status = 'completed') AS completed_bookings
     FROM users u
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Ban a user.
export async function ban(id, reason) {
  const { rows } = await query(
    `UPDATE users SET is_banned = true, ban_reason = $2, updated_at = now()
     WHERE id = $1 RETURNING id, telegram_id, name, is_banned, ban_reason`,
    [id, reason]
  );
  return rows[0] || null;
}

// Unban a user.
export async function unban(id) {
  const { rows } = await query(
    `UPDATE users SET is_banned = false, ban_reason = NULL, updated_at = now()
     WHERE id = $1 RETURNING id, telegram_id, name, is_banned, ban_reason`,
    [id]
  );
  return rows[0] || null;
}

// Change user role.
export async function setRole(id, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2, updated_at = now() WHERE id = $1
     RETURNING id, telegram_id, name, role`,
    [id, role]
  );
  return rows[0] || null;
}

// Create a new user (admin-created, requires telegram_id).
export async function create({ telegramId, name, username, phone, role = 'driver', languagePref = 'en' }) {
  const { rows } = await query(
    `INSERT INTO users (telegram_id, name, username, phone, role, language_pref)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, telegram_id, name, username, phone, role, language_pref, is_banned, created_at`,
    [telegramId, name || null, username || null, phone || null, role, languagePref]
  );
  return rows[0] || null;
}

// Update user fields (admin override).
export async function update(id, fields) {
  const sets = [];
  const params = [id];
  let idx = 2;
  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.username !== undefined) { sets.push(`username = $${idx++}`); params.push(fields.username); }
  if (fields.phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(fields.phone); }
  if (fields.role !== undefined) { sets.push(`role = $${idx++}`); params.push(fields.role); }
  if (fields.language_pref !== undefined) { sets.push(`language_pref = $${idx++}`); params.push(fields.language_pref); }
  if (sets.length === 0) return null;
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1
     RETURNING id, telegram_id, name, username, phone, role, language_pref, is_banned, created_at`,
    params
  );
  return rows[0] || null;
}
