import { query } from '../../index.js';

// List all bookings with pagination and filters.
export async function listAll({
  status,
  paymentStatus,
  dateFrom,
  dateTo,
  limit = 20,
  offset = 0,
} = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`b.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (paymentStatus) {
    conditions.push(`b.payment_status = $${paramIndex}`);
    params.push(paymentStatus);
    paramIndex++;
  }

  if (dateFrom) {
    conditions.push(`b.start_time >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`b.start_time <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: bookings } = await query(
    `SELECT b.*, s.address, s.owner_id,
            d.name AS driver_name, d.telegram_id AS driver_telegram_id
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     ${whereClause}
     ORDER BY b.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const { rows: count } = await query(
    `SELECT COUNT(*) FROM bookings b ${whereClause}`,
    params
  );

  return {
    bookings,
    total: parseInt(count[0].count, 10),
  };
}

// Get booking details with parties and payment.
export async function getById(id) {
  const { rows } = await query(
    `SELECT b.*, s.address, s.owner_id,
            d.name AS driver_name, d.telegram_id AS driver_telegram_id,
            o.name AS owner_name, o.telegram_id AS owner_telegram_id,
            p.id AS payment_id, p.method AS payment_method, p.status AS payment_status,
            p.amount AS payment_amount, p.reference AS payment_reference
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     JOIN users o ON o.id = s.owner_id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Cancel booking with reason.
export async function cancel(id, reason) {
  const { rows } = await query(
    `UPDATE bookings SET status = 'cancelled', cancelled_reason = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, reason]
  );
  return rows[0] || null;
}

// Create a new booking (admin override).
export async function create({ driverId, spotId, startTime, endTime, status = 'reserved', totalPrice = 0, paymentStatus = 'unpaid', confirmationCode = null }) {
  const { rows } = await query(
    `INSERT INTO bookings
       (driver_id, spot_id, start_time, end_time, status, total_price, payment_status, confirmation_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [driverId, spotId, startTime, endTime, status, totalPrice, paymentStatus, confirmationCode]
  );
  return rows[0] || null;
}

// Update booking fields (admin override).
export async function update(id, fields) {
  const sets = [];
  const params = [id];
  let idx = 2;
  if (fields.status !== undefined) { sets.push(`status = $${idx++}`); params.push(fields.status); }
  if (fields.payment_status !== undefined) { sets.push(`payment_status = $${idx++}`); params.push(fields.payment_status); }
  if (fields.start_time !== undefined) { sets.push(`start_time = $${idx++}`); params.push(fields.start_time); }
  if (fields.end_time !== undefined) { sets.push(`end_time = $${idx++}`); params.push(fields.end_time); }
  if (fields.total_price !== undefined) { sets.push(`total_price = $${idx++}`); params.push(fields.total_price); }
  if (fields.confirmation_code !== undefined) { sets.push(`confirmation_code = $${idx++}`); params.push(fields.confirmation_code); }
  if (sets.length === 0) return null;
  const { rows } = await query(
    `UPDATE bookings SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}

// Mark payment as refunded.
export async function refundPayment(paymentId) {
  const { rows } = await query(
    `UPDATE payments SET status = 'refunded', updated_at = now()
     WHERE id = $1 RETURNING *`,
    [paymentId]
  );
  return rows[0] || null;
}

// Get payment details with booking, driver, spot, and host context.
export async function getPaymentById(id) {
  const { rows } = await query(
    `SELECT p.*,
            b.id AS booking_id,
            b.confirmation_code,
            b.status AS booking_status,
            b.payment_status AS booking_payment_status,
            b.start_time,
            b.end_time,
            b.total_price AS booking_total_price,
            s.id AS spot_id,
            s.address,
            s.owner_id,
            d.name AS driver_name,
            d.telegram_id AS driver_telegram_id,
            o.name AS owner_name,
            o.telegram_id AS owner_telegram_id
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     JOIN users o ON o.id = s.owner_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// List all payments with pagination.
export async function listPayments({ status, method, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`p.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (method) {
    conditions.push(`p.method = $${paramIndex}`);
    params.push(method);
    paramIndex++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: payments } = await query(
    `SELECT p.*, b.confirmation_code, s.address, d.name AS driver_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const { rows: count } = await query(
    `SELECT COUNT(*) FROM payments p ${whereClause}`,
    params
  );

  return {
    payments,
    total: parseInt(count[0].count, 10),
  };
}
