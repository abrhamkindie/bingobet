import { query } from '../index.js';

// Nearby active+available spots via the PostGIS function. radiusM in metres.
export async function findNearby({ lat, lng, radiusM, limit }) {
  const { rows } = await query(
    `SELECT n.*, COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(n.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            n.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
       FROM find_nearby_spots($1, $2, $3, $4) n
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS occupied_spaces
         FROM bookings b
         WHERE b.spot_id = n.id
           AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
           AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
       ) o ON true`,
    [lat, lng, radiusM, limit]
  );
  return rows;
}

// Nearest active+available spots IGNORING the radius. Dev convenience so a
// search always shows something (with the real distance) even when you're far
// from the seed data, instead of a bare "nothing found".
export async function findNearestAny({ lat, lng, limit }) {
  const { rows } = await query(
    `SELECT s.id, s.owner_id, s.address, s.price_per_hour, s.capacity,
            s.covered, s.guarded, s.ev_charging, s.rating_avg, s.rating_count,
            ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
            ST_Distance(s.geom, ST_MakePoint($2, $1)::geography) AS distance_m,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
       FROM spots s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS occupied_spaces
         FROM bookings b
         WHERE b.spot_id = s.id
           AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
           AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
       ) o ON true
      WHERE s.status = 'active' AND s.is_available = true
      ORDER BY distance_m ASC, s.price_per_hour ASC
      LIMIT $3`,
    [lat, lng, limit]
  );
  return rows;
}

// All active+available spots for the map. If a centre is supplied, rows include
// distance_m and are sorted nearest-first; otherwise newest listings come first.
export async function listActiveMap({ lat = null, lng = null, limit = 200 } = {}) {
  const hasLatLng = lat !== null && lat !== undefined && lat !== '' && lng !== null && lng !== undefined && lng !== '';
  const latitude = Number(lat);
  const longitude = Number(lng);
  const hasCenter = hasLatLng && Number.isFinite(latitude) && Number.isFinite(longitude);

  const distanceSelect = hasCenter
    ? 'ST_Distance(s.geom, ST_MakePoint($2, $1)::geography) AS distance_m'
    : 'NULL::double precision AS distance_m';
  const orderBy = hasCenter
    ? 'distance_m ASC, s.price_per_hour ASC'
    : 's.created_at DESC, s.price_per_hour ASC';
  const params = hasCenter ? [latitude, longitude, limit] : [limit];
  const limitParam = hasCenter ? '$3' : '$1';

  const { rows } = await query(
    `SELECT s.id, s.owner_id, s.address, s.price_per_hour, s.capacity,
            s.covered, s.guarded, s.ev_charging, s.rating_avg, s.rating_count,
            ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
            ${distanceSelect},
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
       FROM spots s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS occupied_spaces
         FROM bookings b
         WHERE b.spot_id = s.id
           AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
           AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
       ) o ON true
      WHERE s.status = 'active' AND s.is_available = true
      ORDER BY ${orderBy}
      LIMIT ${limitParam}`,
    params
  );
  return rows;
}

// Text search across active+available spots. Search uses address and access
// instructions, with optional distance sorting around a supplied centre.
export async function searchActiveMap({ q, lat = null, lng = null, limit = 100 }) {
  const term = String(q || '').trim();
  if (!term) return listActiveMap({ lat, lng, limit });

  const hasLatLng = lat !== null && lat !== undefined && lat !== '' && lng !== null && lng !== undefined && lng !== '';
  const latitude = Number(lat);
  const longitude = Number(lng);
  const hasCenter = hasLatLng && Number.isFinite(latitude) && Number.isFinite(longitude);
  const pattern = `%${term}%`;
  const prefix = `${term}%`;
  const distanceSelect = hasCenter
    ? 'ST_Distance(s.geom, ST_MakePoint($3, $2)::geography) AS distance_m'
    : 'NULL::double precision AS distance_m';
  const params = hasCenter
    ? [pattern, latitude, longitude, prefix, limit]
    : [pattern, prefix, limit];
  const prefixParam = hasCenter ? '$4' : '$2';
  const limitParam = hasCenter ? '$5' : '$3';
  const orderBy = hasCenter
    ? `match_rank ASC, distance_m ASC, s.price_per_hour ASC`
    : `match_rank ASC, s.created_at DESC, s.price_per_hour ASC`;

  const { rows } = await query(
    `SELECT s.id, s.owner_id, s.address, s.price_per_hour, s.capacity,
            s.covered, s.guarded, s.ev_charging, s.rating_avg, s.rating_count,
            ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
            ${distanceSelect},
            CASE
              WHEN COALESCE(s.address, '') ILIKE ${prefixParam} THEN 0
              WHEN COALESCE(s.address, '') ILIKE $1 THEN 1
              ELSE 2
            END AS match_rank,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
       FROM spots s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS occupied_spaces
         FROM bookings b
         WHERE b.spot_id = s.id
           AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
           AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
       ) o ON true
      WHERE s.status = 'active'
        AND s.is_available = true
        AND (
          COALESCE(s.address, '') ILIKE $1
          OR COALESCE(s.access_instructions, '') ILIKE $1
        )
      ORDER BY ${orderBy}
      LIMIT ${limitParam}`,
    params
  );
  return rows;
}

// Create a host's spot. geom is built from lng/lat; photos holds the optional
// Telegram file_id. New spots start as 'pending_approval' — admin must approve
// before they appear in search results. Returns the row with lat/lng projected out.
export async function create({
  ownerId,
  lat,
  lng,
  address,
  pricePerHour,
  capacity = 1,
  covered = false,
  guarded = false,
  evCharging = false,
  photoFileId = null,
  photos: photoUrls = [],
  accessInstructions = null,
  status = 'pending_approval',
}) {
  const photos = photoUrls.length ? photoUrls : (photoFileId ? [photoFileId] : []);
  const { rows } = await query(
    `INSERT INTO spots
       (owner_id, geom, address, price_per_hour, capacity,
        covered, guarded, ev_charging, photos, access_instructions, status, is_available)
     VALUES ($1, ST_MakePoint($3, $2)::geography, $4, $5, $6,
             $7, $8, $9, $10, $11, $12, true)
     RETURNING *, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
    [ownerId, lat, lng, address, pricePerHour, capacity, covered, guarded, evCharging, photos, accessInstructions, status]
  );
  return rows[0];
}

// Update a spot's hourly price (owner-scoped). Returns the row or null.
export async function updatePrice(id, ownerId, pricePerHour) {
  const { rows } = await query(
    `UPDATE spots SET price_per_hour = $3
     WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [id, ownerId, pricePerHour]
  );
  return rows[0] || null;
}

// Delete a spot (owner-scoped). Returns the deleted row or null.
export async function remove(id, ownerId) {
  const { rows } = await query(
    `DELETE FROM spots WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [id, ownerId]
  );
  return rows[0] || null;
}

export async function getById(id) {
  const { rows } = await query(
    `SELECT s.*,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
     FROM spots s
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS occupied_spaces
       FROM bookings b
       WHERE b.spot_id = s.id
         AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
         AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
     ) o ON true
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function listByOwner(ownerId) {
  const { rows } = await query(
    `SELECT s.*, ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
     FROM spots s
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS occupied_spaces
       FROM bookings b
       WHERE b.spot_id = s.id
         AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
         AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
     ) o ON true
     WHERE s.owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function setAvailability(spotId, ownerId, isAvailable) {
  const { rows } = await query(
    `UPDATE spots SET is_available = $3
     WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [spotId, ownerId, isAvailable]
  );
  return rows[0] || null;
}

// Browse all active+available spots within a bounding box (for area browsing).
// Returns rows with a centre-point distance from the area's centre.
export async function findByArea({ centerLat, centerLng, latDelta, lngDelta, limit }) {
  const { rows } = await query(
    `SELECT s.id, s.owner_id, s.address, s.price_per_hour, s.capacity,
            s.covered, s.guarded, s.ev_charging, s.rating_avg, s.rating_count,
            ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lng,
            ST_Distance(s.geom, ST_MakePoint($2, $1)::geography) AS distance_m,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now
       FROM spots s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::integer AS occupied_spaces
         FROM bookings b
         WHERE b.spot_id = s.id
           AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
           AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
       ) o ON true
      WHERE s.status = 'active' AND s.is_available = true
        AND ST_Y(s.geom::geometry) BETWEEN $1 - $3 AND $1 + $3
        AND ST_X(s.geom::geometry) BETWEEN $2 - $4 AND $2 + $4
      ORDER BY distance_m ASC, s.price_per_hour ASC
      LIMIT $5`,
    [centerLat, centerLng, latDelta, lngDelta, limit]
  );
  return rows;
}

export async function getAvailability(spotId, { start = new Date(), hours = 1 } = {}) {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + Number(hours || 1) * 60 * 60 * 1000);
  const { rows } = await query(
    `SELECT s.id, s.capacity, s.status, s.is_available,
            COUNT(b.id)::integer AS occupied_spaces
       FROM spots s
       LEFT JOIN bookings b ON b.spot_id = s.id
        AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
        AND tstzrange(b.start_time, b.end_time) && tstzrange($2::timestamptz, $3::timestamptz)
      WHERE s.id = $1
      GROUP BY s.id`,
    [spotId, startDate.toISOString(), endDate.toISOString()]
  );
  const row = rows[0] || null;
  if (!row) return null;
  const capacity = Number(row.capacity) || 0;
  const occupied = Number(row.occupied_spaces) || 0;
  const available = Math.max(capacity - occupied, 0);
  return {
    spot_id: Number(row.id),
    is_available: row.status === 'active' && row.is_available === true && available > 0,
    host_available: row.is_available === true,
    status: row.status,
    capacity,
    occupied_spaces: occupied,
    available_spaces: available,
    is_full: available <= 0,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
  };
}
