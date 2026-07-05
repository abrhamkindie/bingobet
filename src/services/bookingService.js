import * as bookingsRepo from '../db/repositories/bookings.js';
import * as spotsRepo from '../db/repositories/spots.js';
import { calcTotal } from './pricing.js';
import { generateConfirmationCode, generateCheckinToken } from '../utils/code.js';
import { logger } from '../utils/logger.js';
import { query } from '../db/index.js';

export class BookingError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // SPOT_NOT_FOUND | SPOT_UNAVAILABLE | CAPACITY_FULL
  }
}

const KNOWN_CODES = ['SPOT_NOT_FOUND', 'SPOT_UNAVAILABLE', 'CAPACITY_FULL'];

// Reserve a spot for [start, start+hours). Returns { booking, spot }.
// Creates booking with status='pending' — transitions to 'reserved' only
// after payment succeeds. Throws BookingError on conflict/unavailability.
export async function reserve({ driverId, spotId, start, hours, paymentStatus = 'unpaid', vehicleId = null }) {
  const spot = await spotsRepo.getById(spotId);
  if (!spot) throw new BookingError('SPOT_NOT_FOUND');

  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
  const total = calcTotal(spot.price_per_hour, hours);
  const code = generateConfirmationCode();

  let bookingId;
  try {
    bookingId = await bookingsRepo.createBooking({
      driverId,
      spotId,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      totalPrice: total,
      confirmationCode: code,
      status: 'pending',
      paymentStatus,
      vehicleId,
    });
  } catch (err) {
    const code = KNOWN_CODES.find((c) => err.message.includes(c));
    if (code) throw new BookingError(code);
    throw err;
  }

  const booking = await bookingsRepo.getById(bookingId);
  return { booking, spot };
}

// Confirm payment for a booking: transitions pending->reserved->confirmed,
// updates payment_status, and generates checkin token.
// Returns booking with parties (for notification).
export async function confirmPayment(bookingId) {
  const booking = await bookingsRepo.getById(bookingId);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');

  let current = booking;

  // Transition: pending -> reserved before confirmation.
  if (current.status === 'pending') {
    current = await bookingsRepo.updateStatus(bookingId, 'reserved') || current;
  }

  if (current.payment_status !== 'paid') {
    const { rows } = await query(
      `UPDATE bookings SET payment_status = 'paid' WHERE id = $1 RETURNING *`,
      [bookingId]
    );
    current = rows[0] || current;
  }

  if (!current.checkin_token) {
    const checkinToken = generateCheckinToken();
    current = await bookingsRepo.attachCheckinToken(bookingId, checkinToken) || current;
  }

  if (['pending', 'reserved'].includes(current.status)) {
    current = await bookingsRepo.updateStatus(bookingId, 'confirmed') || current;
  }

  // Return full booking with parties
  const fullBooking = await bookingsRepo.getByIdWithParties(bookingId);
  if (!fullBooking) {
    throw new Error('Booking not found after payment confirmation');
  }

  logger.info('Payment confirmed for booking', { bookingId, confirmationCode: fullBooking.confirmation_code });

  return fullBooking;
}
