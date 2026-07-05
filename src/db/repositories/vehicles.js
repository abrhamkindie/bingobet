import { query } from '../index.js';

// List all vehicles for a user.
export async function listByUser(userId) {
  const { rows } = await query(
    `SELECT * FROM vehicles WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

// Get a single vehicle by ID (user-scoped).
export async function getById(id, userId) {
  const { rows } = await query(
    `SELECT * FROM vehicles WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

// Get the user's default vehicle.
export async function getDefault(userId) {
  const { rows } = await query(
    `SELECT * FROM vehicles WHERE user_id = $1 AND is_default = true`,
    [userId]
  );
  return rows[0] || null;
}

// Add a new vehicle. If it's the first vehicle, make it default.
export async function create({ userId, plateNumber, vehicleType = 'car', color = null }) {
  // Check if user has any vehicles
  const { rows: existing } = await query(
    `SELECT id FROM vehicles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const isDefault = existing.length === 0;

  const { rows } = await query(
    `INSERT INTO vehicles (user_id, plate_number, vehicle_type, color, is_default)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, plateNumber.toUpperCase(), vehicleType, color, isDefault]
  );
  return rows[0];
}

// Set a vehicle as the default (unsets others).
export async function setDefault(id, userId) {
  // First unset all defaults for this user
  await query(
    `UPDATE vehicles SET is_default = false WHERE user_id = $1`,
    [userId]
  );
  // Then set this one as default
  const { rows } = await query(
    `UPDATE vehicles SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return rows[0] || null;
}

// Remove a vehicle (user-scoped).
export async function remove(id, userId) {
  const { rows } = await query(
    `DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  const deleted = rows[0] || null;

  // If we deleted the default and there are other vehicles, make the first one default
  if (deleted && deleted.is_default) {
    const { rows: remaining } = await query(
      `SELECT id FROM vehicles WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    if (remaining.length > 0) {
      await setDefault(remaining[0].id, userId);
    }
  }

  return deleted;
}

// Update vehicle details.
export async function update(id, userId, fields) {
  const sets = [];
  const params = [id, userId];
  let idx = 3;
  if (fields.plateNumber !== undefined) { sets.push(`plate_number = $${idx++}`); params.push(fields.plateNumber.toUpperCase()); }
  if (fields.vehicleType !== undefined) { sets.push(`vehicle_type = $${idx++}`); params.push(fields.vehicleType); }
  if (fields.color !== undefined) { sets.push(`color = $${idx++}`); params.push(fields.color); }
  if (sets.length === 0) return null;
  const { rows } = await query(
    `UPDATE vehicles SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}
