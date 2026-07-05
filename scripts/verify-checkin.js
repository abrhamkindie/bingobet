#!/usr/bin/env node
// Integration + unit smoke test for the check-in subsystem.
import assert from 'node:assert/strict';
import { generateCheckinToken } from '../src/utils/code.js';
import { checkinLink } from '../src/utils/deeplink.js';
import { checkinQrPng } from '../src/utils/qr.js';

function section(name) { console.log('\n[' + name + ']'); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  // Idempotency: remove rows left by previous runs of this script.
  const _db = await import('../src/db/index.js');
  await _db.query(
    "DELETE FROM bookings WHERE driver_id IN (SELECT id FROM users WHERE telegram_id IN (999000111, 999000222))"
  );

  section('utils');
  const tok = generateCheckinToken();
  assert.match(tok, /^[A-Za-z0-9_-]{20,}$/, 'token is url-safe and long enough');
  assert.notEqual(generateCheckinToken(), tok, 'tokens are unique');
  ok('generateCheckinToken produces unique url-safe tokens');

  const link = checkinLink('ABC123');
  assert.equal(link, 'https://t.me/ParkAddisBot?start=checkin_ABC123', 'deep link format');
  ok('checkinLink builds the t.me deep link');

  const png = await checkinQrPng(link);
  assert.ok(Buffer.isBuffer(png) && png.length > 100, 'QR is a non-trivial PNG buffer');
  assert.equal(png[0], 0x89, 'PNG magic byte');
  ok('checkinQrPng renders a PNG buffer');

  section('confirmPayment attaches token');
  const spots = await import('../src/db/repositories/spots.js');
  const usersRepo = await import('../src/db/repositories/users.js');
  const { reserve, confirmPayment } = await import('../src/services/bookingService.js');

  const near = await spots.findNearby({ lat: 8.995, lng: 38.799, radiusM: 5000, limit: 10 });
  assert.ok(near.length >= 2, 'need at least 2 active seeded spots (run npm run db:seed)');
  const driver = await usersRepo.upsertUser({ telegramId: 999000111, name: 'QR Driver' });
  const { booking } = await reserve({ driverId: driver.id, spotId: near[0].id, start: new Date(), hours: 1 });

  // confirmPayment attaches the checkin_token and sets status to 'confirmed'
  const confirmed = await confirmPayment(booking.id);
  assert.match(confirmed.checkin_token || '', /^[A-Za-z0-9_-]{20,}$/, 'confirmPayment() attaches a checkin_token');
  assert.equal(confirmed.status, 'confirmed', 'status becomes confirmed after payment');
  ok('confirmPayment() generates and persists a checkin_token');

  section('checkinService');
  const { checkIn, complete, CheckinError,
    checkInByConfirmationCode, checkInByBookingId } = await import('../src/services/checkinService.js');

  const ownerId = (await spots.getById(near[0].id)).owner_id;
  const owner = await usersRepo.getById(ownerId);

  // Non-owner cannot check in.
  await assert.rejects(
    () => checkIn({ scannerTelegramId: 123456789, scannerRole: 'driver', token: confirmed.checkin_token }),
    (e) => e instanceof CheckinError && e.code === 'NOT_OWNER',
    'non-owner is rejected'
  );
  ok('NOT_OWNER enforced');

  // Owner checks in successfully via QR token.
  const res = await checkIn({ scannerTelegramId: owner.telegram_id, scannerRole: owner.role, token: confirmed.checkin_token });
  assert.equal(res.booking.status, 'active', 'status becomes active');
  assert.ok(res.booking.checked_in_at, 'checked_in_at is set');
  ok('owner check-in via QR token transitions to active');

  // Second check-in via QR token is rejected.
  await assert.rejects(
    () => checkIn({ scannerTelegramId: owner.telegram_id, scannerRole: owner.role, token: confirmed.checkin_token }),
    (e) => e instanceof CheckinError && e.code === 'ALREADY_CHECKED_IN',
    'already-checked-in rejected'
  );
  ok('ALREADY_CHECKED_IN enforced for QR token');

  // Unknown token.
  await assert.rejects(
    () => checkIn({ scannerTelegramId: owner.telegram_id, scannerRole: owner.role, token: 'nope-not-real' }),
    (e) => e instanceof CheckinError && e.code === 'NOT_FOUND',
    'unknown token rejected'
  );
  ok('NOT_FOUND enforced');

  // --- Test Option 1: Check-in by confirmation code ---
  section('checkInByConfirmationCode');
  const start2 = new Date(Date.now() + 2 * 3600 * 1000); // different time slot, same spot
  const { booking: bk2 } = await reserve({ driverId: driver.id, spotId: near[0].id, start: start2, hours: 1 });
  const confirmed2 = await confirmPayment(bk2.id);

  // Owner checks in by typing the confirmation code.
  const byCode = await checkInByConfirmationCode({
    scannerTelegramId: owner.telegram_id,
    scannerRole: owner.role,
    confirmationCode: confirmed2.confirmation_code,
  });
  assert.equal(byCode.booking.status, 'active', 'status becomes active via confirmation code');
  assert.ok(byCode.booking.checked_in_at, 'checked_in_at is set');
  ok('owner check-in by confirmation code works');

  // --- Test Option 2: Check-in by booking ID (host button) ---
  section('checkInByBookingId');
  const start3 = new Date(Date.now() + 6 * 3600 * 1000); // different time slot, same spot
  const { booking: bk3 } = await reserve({ driverId: driver.id, spotId: near[0].id, start: start3, hours: 1 });
  const confirmed3 = await confirmPayment(bk3.id);

  // Owner checks in by tapping a button with the booking ID.
  const byId = await checkInByBookingId({
    scannerTelegramId: owner.telegram_id,
    scannerRole: owner.role,
    bookingId: confirmed3.id,
  });
  assert.equal(byId.booking.status, 'active', 'status becomes active via booking ID');
  assert.ok(byId.booking.checked_in_at, 'checked_in_at is set');
  ok('owner check-in by booking ID works');

  // --- Test expired ---
  section('expired booking');
  const expDriver = await usersRepo.upsertUser({ telegramId: 999000222, name: 'Exp Driver' });
  const past = new Date(Date.now() - 5 * 3600 * 1000);
  const { booking: expB } = await reserve({ driverId: expDriver.id, spotId: near[0].id, start: past, hours: 1 });
  const expConfirmed = await confirmPayment(expB.id);
  await assert.rejects(
    () => checkIn({ scannerTelegramId: owner.telegram_id, scannerRole: owner.role, token: expConfirmed.checkin_token }),
    (e) => e instanceof CheckinError && e.code === 'EXPIRED',
    'expired rejected'
  );
  ok('EXPIRED enforced');

  // Complete the active booking.
  const done = await complete({ bookingId: res.booking.id, scannerTelegramId: owner.telegram_id, scannerRole: owner.role });
  assert.equal(done.status, 'completed', 'status becomes completed');
  assert.ok(done.checked_out_at, 'checked_out_at is set');
  ok('complete transitions to completed');

  console.log('\nALL CHECK-IN CHECKS PASSED ✅\n');
  const db = await import('../src/db/index.js');
  await db.close();
}

main().catch((err) => { console.error('\n' + err.stack + '\n'); process.exitCode = 1; });
