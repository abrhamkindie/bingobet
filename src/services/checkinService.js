import * as bookingsRepo from '../db/repositories/bookings.js';
import * as hostRepo from '../db/repositories/host.js';

export class CheckinError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // NOT_FOUND | NOT_OWNER | ALREADY_CHECKED_IN | INVALID_STATE | EXPIRED | NOT_COMPLETABLE
  }
}

async function authorize(booking, scannerTelegramId, scannerRole) {
  const isOwner = String(booking.owner_telegram_id) === String(scannerTelegramId);
  const isAdmin = scannerRole === 'admin';
  if (isOwner || isAdmin) return;

  const isManager = await hostRepo.canManageBookingByTelegram({
    bookingId: booking.id,
    telegramId: scannerTelegramId,
  });
  if (!isManager) throw new CheckinError('NOT_OWNER');
}

// Shared check-in logic: validate a booking, transition it to active.
// Throws CheckinError. Returns { booking } with joined fields.
async function executeCheckIn(booking, scannerTelegramId, scannerRole) {
  await authorize(booking, scannerTelegramId, scannerRole);

  if (booking.status === 'active') throw new CheckinError('ALREADY_CHECKED_IN');
  if (!['reserved', 'confirmed'].includes(booking.status)) throw new CheckinError('INVALID_STATE');
  if (new Date(booking.end_time).getTime() < Date.now()) throw new CheckinError('EXPIRED');

  const updated = await bookingsRepo.markCheckedIn(booking.id);
  if (!updated) throw new CheckinError('ALREADY_CHECKED_IN'); // lost a concurrent race

  return { booking: { ...booking, ...updated } };
}

// Check a booking in by its QR token. Returns { booking } (with joined parties).
export async function checkIn({ scannerTelegramId, scannerRole, token }) {
  const booking = await bookingsRepo.getByCheckinToken(token);
  if (!booking) throw new CheckinError('NOT_FOUND');
  return executeCheckIn(booking, scannerTelegramId, scannerRole);
}

// Check a booking in by its confirmation code (manual /checkin command).
export async function checkInByConfirmationCode({ scannerTelegramId, scannerRole, confirmationCode }) {
  const booking = await bookingsRepo.getByConfirmationCode(confirmationCode);
  if (!booking) throw new CheckinError('NOT_FOUND');
  return executeCheckIn(booking, scannerTelegramId, scannerRole);
}

// Check a booking in by its ID (host booking list button).
export async function checkInByBookingId({ scannerTelegramId, scannerRole, bookingId }) {
  const booking = await bookingsRepo.getByIdWithParties(bookingId);
  if (!booking) throw new CheckinError('NOT_FOUND');
  return executeCheckIn(booking, scannerTelegramId, scannerRole);
}

// Mark an active booking complete (owner/admin only).
export async function complete({ bookingId, scannerTelegramId, scannerRole }) {
  const booking = await bookingsRepo.getByIdWithParties(bookingId);
  if (!booking) throw new CheckinError('NOT_FOUND');

  await authorize(booking, scannerTelegramId, scannerRole);

  const updated = await bookingsRepo.markCompleted(bookingId);
  if (!updated) throw new CheckinError('NOT_COMPLETABLE');
  return updated;
}
