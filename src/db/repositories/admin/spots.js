import { query } from '../../index.js';

const activeOccupancyJoin = `LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS occupied_spaces
  FROM bookings b
  WHERE b.spot_id = s.id
    AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
    AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
) o ON true`;

// List all spots with pagination and optional status filter.
export async function listAll({ status, limit = 20, offset = 0 } = {}) {
  let whereClause = '';
  const params = [limit, offset];

  if (status) {
    whereClause = 'WHERE s.status = $3';
    params.push(status);
  }

  const { rows: spots } = await query(
    `SELECT s.*, u.name AS owner_name, u.telegram_id AS owner_telegram_id,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces
     FROM spots s
     JOIN users u ON u.id = s.owner_id
     ${activeOccupancyJoin}
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  );

  const { rows: count } = await query(
    `SELECT COUNT(*) FROM spots s ${status ? 'WHERE s.status = $1' : ''}`,
    status ? [status] : []
  );

  return {
    spots,
    total: parseInt(count[0].count, 10),
  };
}

// Get spot details with owner, location, booking count, and current occupancy.
export async function getById(id) {
  const { rows } = await query(
    `SELECT s.*, u.name AS owner_name, u.telegram_id AS owner_telegram_id,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            (SELECT COUNT(*) FROM bookings WHERE spot_id = s.id) AS booking_count,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces
     FROM spots s
     JOIN users u ON u.id = s.owner_id
     ${activeOccupancyJoin}
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Approve a pending spot.
export async function approve(id, adminId = null) {
  const { rows } = await query(
    `UPDATE spots
        SET status = 'active',
            rejection_reason = NULL,
            approved_at = now(),
            approved_by = $2,
            rejected_at = NULL,
            rejected_by = NULL,
            updated_at = now()
      WHERE id = $1
      RETURNING *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
    [id, adminId]
  );
  return rows[0] || null;
}

// Reject a spot with reason.
export async function reject(id, reason, adminId = null) {
  const { rows } = await query(
    `UPDATE spots
        SET status = 'rejected',
            rejection_reason = $2,
            rejected_at = now(),
            rejected_by = $3,
            updated_at = now()
      WHERE id = $1
      RETURNING *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
    [id, reason || null, adminId]
  );
  return rows[0] || null;
}

// Suspend an active spot.
export async function suspend(id) {
  const { rows } = await query(
    `UPDATE spots SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// Reactivate a suspended/rejected spot.
export async function reactivate(id) {
  const { rows } = await query(
    `UPDATE spots SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// Update spot price (admin override).
export async function updatePrice(id, price) {
  const { rows } = await query(
    `UPDATE spots SET price_per_hour = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, price]
  );
  return rows[0] || null;
}

// Create a new spot as admin (bypasses owner-scoped checks).
export async function create({ ownerId, address, lat, lng, pricePerHour, capacity, covered, guarded, evCharging, accessInstructions = null, photos = [], status = 'active', isAvailable = true }) {
  const { rows } = await query(
    `INSERT INTO spots
       (owner_id, geom, address, price_per_hour, capacity,
        covered, guarded, ev_charging, access_instructions, photos, status, is_available)
     VALUES ($1, ST_MakePoint($3, $2)::geography, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
    [ownerId, lat, lng, address, pricePerHour, capacity, covered, guarded, evCharging, accessInstructions, photos, status, isAvailable]
  );
  return rows[0] || null;
}

// Update spot fields (admin override).
export async function update(id, fields) {
  const sets = [];
  const params = [id];
  let idx = 2;
  if (fields.address !== undefined) { sets.push(`address = $${idx++}`); params.push(fields.address); }
  if (fields.price_per_hour !== undefined) { sets.push(`price_per_hour = $${idx++}`); params.push(fields.price_per_hour); }
  if (fields.capacity !== undefined) { sets.push(`capacity = $${idx++}`); params.push(fields.capacity); }
  if (fields.covered !== undefined) { sets.push(`covered = $${idx++}`); params.push(fields.covered); }
  if (fields.guarded !== undefined) { sets.push(`guarded = $${idx++}`); params.push(fields.guarded); }
  if (fields.ev_charging !== undefined) { sets.push(`ev_charging = $${idx++}`); params.push(fields.ev_charging); }
  if (fields.access_instructions !== undefined) { sets.push(`access_instructions = $${idx++}`); params.push(fields.access_instructions); }
  if (fields.photos !== undefined) { sets.push(`photos = $${idx++}`); params.push(fields.photos); }
  if (fields.status !== undefined) { sets.push(`status = $${idx++}`); params.push(fields.status); }
  if (fields.is_available !== undefined) { sets.push(`is_available = $${idx++}`); params.push(fields.is_available); }
  if (fields.lat !== undefined && fields.lng !== undefined) {
    sets.push(`geom = ST_MakePoint($${idx+1}, $${idx})::geography`);
    params.push(fields.lat, fields.lng);
    idx += 2;
  }
  if (sets.length === 0) return null;
  const { rows } = await query(
    `UPDATE spots SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
    params
  );
  return rows[0] || null;
}
