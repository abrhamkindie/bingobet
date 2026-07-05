import { query } from '../index.js';

// Create a dispute for a booking.
export async function createDispute({ bookingId, raisedBy, reason }) {
  // Check if a dispute already exists for this booking
  const { rows: existing } = await query(
    `SELECT id FROM disputes WHERE booking_id = $1 AND status = 'open'`,
    [bookingId]
  );
  if (existing.length > 0) {
    throw new Error('DISPUTE_ALREADY_EXISTS');
  }

  const { rows } = await query(
    `INSERT INTO disputes (booking_id, raised_by, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [bookingId, raisedBy, reason]
  );
  return rows[0];
}

// Get disputes for a user (as the raiser).
export async function listByUser(userId, limit = 10) {
  const { rows } = await query(
    `SELECT d.*, b.confirmation_code, s.address, b.start_time, b.end_time
     FROM disputes d
     JOIN bookings b ON b.id = d.booking_id
     JOIN spots s ON s.id = b.spot_id
     WHERE d.raised_by = $1
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

// Get dispute by ID.
export async function getById(id) {
  const { rows } = await query(
    `SELECT d.*, b.confirmation_code, s.address, b.start_time, b.end_time, b.total_price,
            u.name AS raised_by_name
     FROM disputes d
     JOIN bookings b ON b.id = d.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN users u ON u.id = d.raised_by
     WHERE d.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Get user's bookings that can have disputes raised (completed or active with issues).
export async function getDisputableBookings(userId) {
  const { rows } = await query(
    `SELECT b.id, b.confirmation_code, b.start_time, b.end_time, b.status, b.total_price,
            s.address
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     WHERE b.driver_id = $1
       AND b.status IN ('confirmed', 'active', 'completed')
       AND b.payment_status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM disputes d 
         WHERE d.booking_id = b.id AND d.status = 'open'
       )
     ORDER BY b.start_time DESC
     LIMIT 20`,
    [userId]
  );
  return rows;
}
