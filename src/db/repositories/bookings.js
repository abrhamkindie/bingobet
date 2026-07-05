import { query } from '../index.js';

// Atomic booking creation via the create_booking SQL function (row lock +
// capacity-aware overlap check). Throws Postgres errors whose .message is one
// of: SPOT_NOT_FOUND, SPOT_UNAVAILABLE, CAPACITY_FULL.
export async function createBooking({
  driverId,
  spotId,
  start,
  end,
  totalPrice,
  confirmationCode,
  status = 'reserved',
  paymentStatus = 'unpaid',
  vehicleId = null,
}) {
  const { rows } = await query(
    `SELECT create_booking($1, $2, $3, $4, $5, $6, $7::booking_status, $8::payment_status) AS id`,
    [driverId, spotId, start, end, totalPrice, confirmationCode, status, paymentStatus]
  );
  const bookingId = rows[0].id;

  // Set vehicle_id if provided (not supported by create_booking SQL function)
  if (vehicleId) {
    await query(
      `UPDATE bookings SET vehicle_id = $2 WHERE id = $1`,
      [bookingId, vehicleId]
    );
  }

  return bookingId;
}

export async function getById(id) {
  const { rows } = await query('SELECT * FROM bookings WHERE id = $1', [id]);
  return rows[0] || null;
}

// Bookings for a driver with the spot address joined in.
export async function listByDriver(driverId, limit = 10, offset = 0, filters = {}) {
  let where = 'WHERE b.driver_id = $1';
  const params = [driverId];
  let idx = 2;

  // Status filter
  if (filters.status) {
    where += ` AND b.status = $${idx++}`;
    params.push(filters.status);
  }

  // Date range filter
  if (filters.fromDate) {
    where += ` AND b.start_time >= $${idx++}`;
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    where += ` AND b.end_time <= $${idx++}`;
    params.push(filters.toDate);
  }

  // Add pagination params
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT b.*, s.address,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            p.id AS payment_id,
            p.method AS payment_method,
            p.status AS payment_record_status,
            p.checkout_url AS payment_checkout_url
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     LEFT JOIN LATERAL (
       SELECT id, method, status, checkout_url
       FROM payments
       WHERE booking_id = b.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) p ON true
     ${where}
     ORDER BY b.start_time DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  // Get total count for pagination
  const countParams = [driverId];
  let countWhere = 'WHERE b.driver_id = $1';
  let countIdx = 2;
  if (filters.status) {
    countWhere += ` AND b.status = $${countIdx++}`;
    countParams.push(filters.status);
  }
  if (filters.fromDate) {
    countWhere += ` AND b.start_time >= $${countIdx++}`;
    countParams.push(filters.fromDate);
  }
  if (filters.toDate) {
    countWhere += ` AND b.end_time <= $${countIdx++}`;
    countParams.push(filters.toDate);
  }

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM bookings b ${countWhere}`,
    countParams
  );

  return {
    bookings: rows,
    total: parseInt(countRows[0].count, 10),
    limit,
    offset,
  };
}

// Upcoming/active bookings for a spot (for the host's "view bookings"), with the
// driver name joined in. Excludes past/cancelled/completed.
export async function listBySpot(spotId, limit = 10) {
  const { rows } = await query(
    `SELECT b.*, d.name AS driver_name
     FROM bookings b JOIN users d ON d.id = b.driver_id
     WHERE b.spot_id = $1
       AND b.status IN ('reserved','confirmed','active')
       AND b.end_time >= now()
     ORDER BY b.start_time ASC
     LIMIT $2`,
    [spotId, limit]
  );
  return rows;
}

export async function updateStatus(id, status, extra = {}) {
  const { rows } = await query(
    `UPDATE bookings SET status = $2,
            cancelled_reason = COALESCE($3, cancelled_reason)
     WHERE id = $1 RETURNING *`,
    [id, status, extra.cancelledReason || null]
  );
  return rows[0] || null;
}

// Shared SELECT that joins a booking with its spot, driver, and owner.
const PARTIES_SELECT = `
  SELECT b.*, s.address, s.owner_id,
         d.name        AS driver_name,
         d.telegram_id AS driver_telegram_id,
         d.language_pref AS driver_language_pref,
         o.telegram_id AS owner_telegram_id,
         o.language_pref AS owner_language_pref,
         o.role        AS owner_role
  FROM bookings b
  JOIN spots s ON s.id = b.spot_id
  JOIN users d ON d.id = b.driver_id
  JOIN users o ON o.id = s.owner_id`;

// Store the QR secret on a booking.
export async function attachCheckinToken(id, token) {
  const { rows } = await query(
    `UPDATE bookings SET checkin_token = $2 WHERE id = $1 RETURNING *`,
    [id, token]
  );
  return rows[0] || null;
}

// Booking (with parties) by its QR token, or null.
export async function getByCheckinToken(token) {
  const { rows } = await query(`${PARTIES_SELECT} WHERE b.checkin_token = $1`, [token]);
  return rows[0] || null;
}

// Booking (with parties) by confirmation code, or null.
export async function getByConfirmationCode(code) {
  const { rows } = await query(`${PARTIES_SELECT} WHERE b.confirmation_code = $1`, [code]);
  return rows[0] || null;
}

// Booking (with parties) by id, or null.
export async function getByIdWithParties(id) {
  const { rows } = await query(`${PARTIES_SELECT} WHERE b.id = $1`, [id]);
  return rows[0] || null;
}

// Atomic check-in: only succeeds from a pre-check-in state. Returns the updated
// row, or null if it wasn't in a check-in-able state (lost race / already done).
export async function markCheckedIn(id) {
  const { rows } = await query(
    `UPDATE bookings SET status = 'active', checked_in_at = now()
     WHERE id = $1 AND status IN ('reserved','confirmed') RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// Atomic completion: only from 'active'. Returns updated row or null.
export async function markCompleted(id) {
  const { rows } = await query(
    `UPDATE bookings SET status = 'completed', checked_out_at = now()
     WHERE id = $1 AND status = 'active' RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

// --- Notification Query Functions ---

// Get bookings starting soon that need a start reminder (30 min before).
export async function getUpcomingForReminder(minutesAhead = 35) {
  const { rows } = await query(
    `${PARTIES_SELECT}
     WHERE b.status IN ('reserved', 'confirmed')
       AND b.notification_start_reminder = false
       AND b.start_time BETWEEN now() AND now() + ($1 * interval '1 minute')`,
    [minutesAhead]
  );
  return rows;
}

// Get unpaid bookings that need a payment warning (10 min after creation).
export async function getUnpaidForWarning(minutesAfter = 10) {
  const { rows } = await query(
    `${PARTIES_SELECT}
     WHERE b.payment_status = 'unpaid'
       AND b.notification_payment_warning = false
       AND b.created_at < now() - ($1 * interval '1 minute')`,
    [minutesAfter]
  );
  return rows;
}

// Get active bookings that need a check-in prompt (at or past start time).
export async function getActiveForCheckinPrompt() {
  const { rows } = await query(
    `${PARTIES_SELECT}
     WHERE b.status IN ('reserved', 'confirmed')
       AND b.notification_checkin_prompt = false
       AND b.start_time <= now()`,
    []
  );
  return rows;
}

// Get upcoming bookings that need a host alert (1 hour before).
export async function getUpcomingForHostAlert(minutesAhead = 65) {
  const { rows } = await query(
    `${PARTIES_SELECT}
     WHERE b.status IN ('reserved', 'confirmed')
       AND b.notification_host_alert = false
       AND b.start_time BETWEEN now() AND now() + ($1 * interval '1 minute')`,
    [minutesAhead]
  );
  return rows;
}

// Get expired unpaid bookings to auto-cancel.
export async function getExpiredUnpaidBookings(minutesAfter = 15) {
  const { rows } = await query(
    `SELECT b.*, s.address, s.owner_id,
            d.name AS driver_name,
            d.telegram_id AS driver_telegram_id,
            d.language_pref AS driver_language_pref,
            o.telegram_id AS owner_telegram_id,
            o.language_pref AS owner_language_pref
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     JOIN users o ON o.id = s.owner_id
     WHERE b.payment_status = 'unpaid'
       AND b.created_at < now() - ($1 * interval '1 minute')
       AND b.status IN ('pending', 'reserved')`,
    [minutesAfter]
  );
  return rows;
}

// Mark a specific notification as sent for a booking.
export async function markNotificationSent(bookingId, notificationType) {
  const columnMap = {
    start_reminder: 'notification_start_reminder',
    payment_warning: 'notification_payment_warning',
    checkin_prompt: 'notification_checkin_prompt',
    host_alert: 'notification_host_alert',
    host_new_booking: 'notification_host_new_booking',
  };

  const column = columnMap[notificationType];
  if (!column) {
    throw new Error(`Invalid notification type: ${notificationType}`);
  }

  const { rows } = await query(
    `UPDATE bookings SET ${column} = true WHERE id = $1 RETURNING id`,
    [bookingId]
  );
  return rows[0] || null;
}

// Atomically claim a notification so concurrent payment/webhook paths do not
// send duplicate host messages.
export async function claimNotification(bookingId, notificationType) {
  const columnMap = {
    host_new_booking: 'notification_host_new_booking',
  };

  const column = columnMap[notificationType];
  if (!column) {
    throw new Error(`Invalid notification type: ${notificationType}`);
  }

  const { rows } = await query(
    `UPDATE bookings
     SET ${column} = true
     WHERE id = $1 AND ${column} = false
     RETURNING id`,
    [bookingId]
  );
  return rows[0] || null;
}
