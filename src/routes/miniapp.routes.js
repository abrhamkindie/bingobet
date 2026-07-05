/**
 * Mini App API routes — exposes all bot functionality as REST endpoints
 * for the React Mini App frontend. All routes require Telegram WebApp auth.
 *
 * @module routes/miniapp
 */
import { Router } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { telegramAuth } from '../middlewares/telegramAuth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { success, created } from '../utils/apiResponse.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { getTranslator } from '../i18n/index.js';
import { AREAS } from '../bot/keyboards.js';
import { getBot } from '../botRef.js';

// Repos
import * as spotsRepo from '../db/repositories/spots.js';
import * as bookingsRepo from '../db/repositories/bookings.js';
import * as vehiclesRepo from '../db/repositories/vehicles.js';
import * as favoritesRepo from '../db/repositories/favorites.js';
import * as usersRepo from '../db/repositories/users.js';
import * as ratingsRepo from '../db/repositories/ratings.js';
import * as paymentsRepo from '../db/repositories/payments.js';
import * as supportTicketsRepo from '../db/repositories/supportTickets.js';
import * as hostRepo from '../db/repositories/host.js';
import * as adminAnalyticsRepo from '../db/repositories/admin/analytics.js';
import * as adminBookingsRepo from '../db/repositories/admin/bookings.js';
import * as adminFinanceRepo from '../db/repositories/admin/finance.js';
import * as adminSpotsRepo from '../db/repositories/admin/spots.js';
import * as adminTicketsRepo from '../db/repositories/admin/tickets.js';
import * as adminUsersRepo from '../db/repositories/admin/users.js';

// Services
import { reserve, BookingError } from '../services/bookingService.js';
import { checkChapaPayment, initiatePayment } from '../services/paymentService.js';
import { submitRating, RatingError, canRateBooking, getUnratedBookings } from '../services/ratingService.js';
import {
  checkIn,
  checkInByConfirmationCode,
  checkInByBookingId,
  complete as completeBooking,
  CheckinError,
} from '../services/checkinService.js';
import { calcTotal } from '../services/pricing.js';

// Utils
import { formatMoney, currency } from '../utils/format.js';
import { checkinQrPng } from '../utils/qr.js';
import { checkinLink } from '../utils/deeplink.js';
import { predictCategoryKey } from '../services/classifier.js';
import { sendTicketReplyNotification } from '../services/notificationService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spotUploadDir = join(__dirname, '../../uploads/spots');
const MAX_SPOT_PHOTOS = 5;
const MAX_SPOT_PHOTO_BYTES = 3 * 1024 * 1024;
const MINIAPP_NEARBY_RADIUS_M = 2000;
const MINIAPP_MAX_MAP_RESULTS = 250;
const MINIAPP_MAX_SEARCH_RESULTS = 100;
const SUPPORT_CATEGORIES = new Set(['payment', 'booking', 'host', 'feature', 'other']);
const ADMIN_REPORT_TYPES = new Set(['payments', 'bookings', 'marketplace', 'support', 'users', 'finance']);
const ADMIN_REPORT_INTERVALS = new Set(['hour', 'day', 'week', 'month', 'year']);

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

/**
 * Creates the miniapp router. All routes are prefixed with /api/miniapp.
 * @returns {import('express').Router}
 */
export function createMiniAppRouter() {
  const router = Router();

  // All routes require Telegram WebApp auth
  router.use(telegramAuth());

  // ── User Profile ────────────────────────────────────────────────────
  router.get('/user', asyncHandler(async (req, res) => {
    const u = req.dbUser;
    const hostAccess = await hostRepo.getHostCapabilities(u.id);
    success(res, {
      id: u.id,
      telegram_id: u.telegram_id,
      name: u.name,
      username: u.username,
      role: u.role,
      language_pref: u.language_pref,
      is_banned: u.is_banned,
      host_access: hostAccess,
    });
  }));

  // Update language preference
  router.put('/user/language', asyncHandler(async (req, res) => {
    const { language } = req.body;
    if (!['en', 'am'].includes(language)) {
      throw new AppError('INVALID_LANGUAGE', 400, 'Language must be en or am');
    }
    const updated = await usersRepo.setLanguage(req.tgUser.id, language);
    success(res, { language_pref: updated.language_pref });
  }));

  router.get('/geo/reverse', asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new AppError('INVALID_COORDS', 400, 'Valid lat and lng are required');
    }

    const fallback = latitude.toFixed(6) + ', ' + longitude.toFixed(6);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      const response = await fetch(url, { headers: { 'User-Agent': 'ParkAddis/1.0' } });
      if (!response.ok) throw new Error('Reverse geocode failed ' + response.status);
      const json = await response.json();
      success(res, { address: json.display_name || fallback, source: 'nominatim' });
    } catch (err) {
      logger.warn('Reverse geocode failed', { error: err.message, lat: latitude, lng: longitude });
      success(res, { address: fallback, source: 'coordinates' });
    }
  }));

  // ── Nearby Spots ────────────────────────────────────────────────────
  router.get('/spots/nearby', asyncHandler(async (req, res) => {
    const { lat, lng } = parseCoords(req.query, { required: true });
    const radiusM = clampInt(req.query.radius, MINIAPP_NEARBY_RADIUS_M, 100, 50000);
    const includeFallback = toBoolean(req.query.fallback);

    let spots = await spotsRepo.findNearby({
      lat, lng, radiusM, limit: MINIAPP_MAX_MAP_RESULTS,
    });
    let fallback = false;

    if (!spots.length && includeFallback) {
      spots = await spotsRepo.findNearestAny({
        lat, lng, limit: config.search.maxResults,
      });
      fallback = true;
    }

    success(res, { fallback, radius_m: radiusM, spots: spots.map(formatSpot) });
  }));

  router.get('/spots/map', asyncHandler(async (req, res) => {
    const { lat, lng, hasCoords } = parseCoords(req.query, { required: false });
    const limit = clampInt(req.query.limit, MINIAPP_MAX_MAP_RESULTS, 1, MINIAPP_MAX_MAP_RESULTS);
    const spots = await spotsRepo.listActiveMap({
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      limit,
    });
    success(res, { spots: spots.map(formatSpot), limit, mode: 'all' });
  }));

  router.get('/spots/search', asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const { lat, lng, hasCoords } = parseCoords(req.query, { required: false });
    const limit = clampInt(req.query.limit, MINIAPP_MAX_SEARCH_RESULTS, 1, MINIAPP_MAX_SEARCH_RESULTS);

    if (!q) {
      success(res, { q, spots: [], limit, mode: 'search' });
      return;
    }

    const spots = await spotsRepo.searchActiveMap({
      q,
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      limit,
    });
    success(res, { q, spots: spots.map(formatSpot), limit, mode: 'search' });
  }));

  // ── Browse Areas ────────────────────────────────────────────────────
  router.get('/areas', asyncHandler(async (_req, res) => {
    success(res, { areas: AREAS });
  }));

  // ── Spots by Area ───────────────────────────────────────────────────
  router.get('/spots/area/:key', asyncHandler(async (req, res) => {
    const area = AREAS.find(a => a.key === req.params.key);
    if (!area) throw new AppError('NOT_FOUND', 404, 'Area not found');

    const spots = await spotsRepo.findByArea({
      centerLat: area.lat, centerLng: area.lng,
      latDelta: 0.025, lngDelta: 0.030,
      limit: config.search.maxResults,
    });
    success(res, { area: area.key, spots: spots.map(formatSpot) });
  }));

  // ── Spot Detail ─────────────────────────────────────────────────────
  router.get('/spots/:id', asyncHandler(async (req, res) => {
    const spot = await spotsRepo.getById(Number(req.params.id));
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    const availability = await spotsRepo.getAvailability(spot.id);
    const reviews = await ratingsRepo.listBySpot(spot.id, 3, 0);
    success(res, {
      spot: formatSpotDetail(spot),
      availability,
      reviews: reviews.ratings.map(formatReview),
      reviewCount: reviews.total,
    });
  }));

  router.get('/spots/:id/availability', asyncHandler(async (req, res) => {
    const { start, hours = 1 } = req.query;
    const availability = await spotsRepo.getAvailability(Number(req.params.id), {
      start: start ? new Date(start) : new Date(),
      hours: Number(hours) || 1,
    });
    if (!availability) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    success(res, { availability });
  }));

  // ── Bookings ────────────────────────────────────────────────────────

  // List user's bookings
  router.get('/bookings', asyncHandler(async (req, res) => {
    const { status, page = 0, limit = 10 } = req.query;
    const result = await bookingsRepo.listByDriver(
      req.dbUser.id,
      Number(limit),
      Number(page) * Number(limit),
      { status: status || undefined }
    );
    success(res, {
      bookings: result.bookings.map(formatBooking),
      total: result.total,
      page: Number(page),
      totalPages: Math.ceil(result.total / Number(limit)),
    });
  }));

  // Booking detail
  router.get('/bookings/:id', asyncHandler(async (req, res) => {
    const b = await bookingsRepo.getById(Number(req.params.id));
    if (!b || String(b.driver_id) !== String(req.dbUser.id)) {
      throw new AppError('NOT_FOUND', 404, 'Booking not found');
    }
    const spot = await spotsRepo.getById(b.spot_id);
    let vehicle = null;
    if (b.vehicle_id) {
      vehicle = await vehiclesRepo.getById(b.vehicle_id, req.dbUser.id);
    }
    const payment = await paymentsRepo.getByBookingId(b.id);
    success(res, {
      booking: formatBooking(b),
      spot: spot ? formatSpotDetail(spot) : null,
      vehicle,
      payment: payment ? formatPayment(payment) : null,
    });
  }));

  // Create booking
  router.post('/bookings', asyncHandler(async (req, res) => {
    const { spotId, startOffsetMin = 0, hours, vehicleId } = req.body;
    if (!spotId || !hours) throw new AppError('MISSING_PARAMS', 400, 'spotId and hours required');

    const start = new Date(Date.now() + Number(startOffsetMin) * 60 * 1000);
    const { booking, spot } = await reserve({
      driverId: req.dbUser.id,
      spotId: Number(spotId),
      start,
      hours: Number(hours),
      vehicleId: vehicleId ? Number(vehicleId) : null,
    });

    logger.info('MiniApp booking created', { bookingId: booking.id, spotId });
    success(res, { booking: formatBooking(booking), spot: formatSpot(spot) });
  }));

  // Cancel booking
  router.post('/bookings/:id/cancel', asyncHandler(async (req, res) => {
    const b = await bookingsRepo.getById(Number(req.params.id));
    if (!b || String(b.driver_id) !== String(req.dbUser.id)) {
      throw new AppError('NOT_FOUND', 404, 'Booking not found');
    }
    await bookingsRepo.updateStatus(b.id, 'cancelled', { cancelledReason: 'Cancelled via Mini App' });
    success(res, { cancelled: true });
  }));

  // Initiate payment for a booking
  router.post('/bookings/:id/pay', asyncHandler(async (req, res) => {
    const { method = 'chapa' } = req.body;
    const bookingId = Number(req.params.id);

    const b = await bookingsRepo.getById(bookingId);
    if (!b || String(b.driver_id) !== String(req.dbUser.id)) {
      throw new AppError('NOT_FOUND', 404, 'Booking not found');
    }

    // Build a minimal ctx for the payment service
    const ctx = {
      from: { username: req.dbUser.username, id: req.tgUser.id },
      dbUser: req.dbUser,
    };

    const returnUrl = `${config.publicUrl}/payment/success?source=miniapp&bookingId=${bookingId}`;
    const callbackUrl = `${config.publicUrl}/api/payments/chapa/webhook?source=miniapp&bookingId=${bookingId}`;
    const { payment, checkoutUrl, reused } = await initiatePayment({ bookingId, method, ctx, returnUrl, callbackUrl });
    success(res, { payment: formatPayment(payment), checkoutUrl, reused: !!reused });
  }));

  // Check or refresh payment status for a booking
  router.post('/bookings/:id/payment/check', asyncHandler(async (req, res) => {
    const bookingId = Number(req.params.id);
    const b = await bookingsRepo.getById(bookingId);
    if (!b || String(b.driver_id) !== String(req.dbUser.id)) {
      throw new AppError('NOT_FOUND', 404, 'Booking not found');
    }

    let payment = await paymentsRepo.getByBookingId(bookingId);
    let booking = b;
    let gatewayStatus = null;
    let paid = booking.payment_status === 'paid';
    let failed = false;

    if (payment?.method === 'chapa' && payment.status === 'pending' && payment.reference) {
      const result = await checkChapaPayment(payment.reference);
      booking = result.booking || booking;
      payment = result.payment || payment;
      gatewayStatus = result.gatewayStatus;
      paid = result.paid;
      failed = result.failed;
    }

    success(res, {
      booking: formatBooking(booking),
      payment: payment ? formatPayment(payment) : null,
      paid,
      failed,
      gatewayStatus,
      qrAvailable: booking.payment_status === 'paid' && !!booking.checkin_token,
    });
  }));

  // QR code is available in the Mini App after payment is confirmed
  router.get('/bookings/:id/qr', asyncHandler(async (req, res) => {
    const bookingId = Number(req.params.id);
    const b = await bookingsRepo.getById(bookingId);
    if (!b || String(b.driver_id) !== String(req.dbUser.id)) {
      throw new AppError('NOT_FOUND', 404, 'Booking not found');
    }

    if (b.payment_status !== 'paid' || !b.checkin_token) {
      throw new AppError('QR_NOT_READY', 409, 'QR code is available after payment is confirmed');
    }

    const checkinUrl = checkinLink(b.checkin_token);
    const png = await checkinQrPng(checkinUrl);
    success(res, {
      qrDataUrl: `data:image/png;base64,${png.toString('base64')}`,
      checkinUrl,
      confirmationCode: b.confirmation_code,
      booking: formatBooking(b),
    });
  }));

  // ── Vehicles ────────────────────────────────────────────────────────
  router.get('/vehicles', asyncHandler(async (req, res) => {
    const vehicles = await vehiclesRepo.listByUser(req.dbUser.id);
    success(res, { vehicles });
  }));

  router.post('/vehicles', asyncHandler(async (req, res) => {
    const { plateNumber, vehicleType = 'car', color } = req.body;
    if (!plateNumber || plateNumber.length < 3) {
      throw new AppError('INVALID_PLATE', 400, 'Plate number must be at least 3 characters');
    }
    const vehicle = await vehiclesRepo.create({
      userId: req.dbUser.id,
      plateNumber: plateNumber.toUpperCase(),
      vehicleType,
      color: color || null,
    });
    created(res, { vehicle });
  }));

  router.put('/vehicles/:id', asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.id);
    const updated = await vehiclesRepo.update(vehicleId, req.dbUser.id, req.body);
    if (!updated) throw new AppError('NOT_FOUND', 404, 'Vehicle not found');
    success(res, { vehicle: updated });
  }));

  router.delete('/vehicles/:id', asyncHandler(async (req, res) => {
    const removed = await vehiclesRepo.remove(Number(req.params.id), req.dbUser.id);
    if (!removed) throw new AppError('NOT_FOUND', 404, 'Vehicle not found');
    success(res, { removed: true });
  }));

  router.post('/vehicles/:id/default', asyncHandler(async (req, res) => {
    const updated = await vehiclesRepo.setDefault(Number(req.params.id), req.dbUser.id);
    if (!updated) throw new AppError('NOT_FOUND', 404, 'Vehicle not found');
    success(res, { vehicle: updated });
  }));

  // ── Favorites ───────────────────────────────────────────────────────
  router.get('/favorites', asyncHandler(async (req, res) => {
    const favorites = await favoritesRepo.getUserFavorites(req.dbUser.id);
    success(res, { favorites: favorites.map(f => ({ id: f.spot_id, address: f.address, price_per_hour: Number(f.price_per_hour), rating_avg: Number(f.rating_avg), rating_count: Number(f.rating_count) })) });
  }));

  router.post('/favorites/:spotId', asyncHandler(async (req, res) => {
    const spotId = Number(req.params.spotId);
    const added = await favoritesRepo.addFavorite(req.dbUser.id, spotId);
    success(res, { added: !!added });
  }));

  router.delete('/favorites/:spotId', asyncHandler(async (req, res) => {
    const removed = await favoritesRepo.removeFavorite(req.dbUser.id, Number(req.params.spotId));
    success(res, { removed: !!removed });
  }));

  // ── Ratings ─────────────────────────────────────────────────────────
  router.post('/ratings', asyncHandler(async (req, res) => {
    const { bookingId, score, comment } = req.body;
    if (!bookingId || !score) throw new AppError('MISSING_PARAMS', 400, 'bookingId and score required');

    try {
      const { rating } = await submitRating({
        bookingId: Number(bookingId),
        driverId: req.dbUser.id,
        score: Number(score),
        comment: comment || null,
      });
      success(res, { rating });
    } catch (err) {
      if (err instanceof RatingError) {
        throw new AppError('RATING_ERROR', 400, err.code);
      }
      throw err;
    }
  }));

  router.get('/ratings/unrated', asyncHandler(async (req, res) => {
    const unrated = await getUnratedBookings(req.dbUser.id);
    success(res, { bookings: unrated.map(b => ({ id: b.id, address: b.address, confirmation_code: b.confirmation_code })) });
  }));

  router.get('/spots/:spotId/reviews', asyncHandler(async (req, res) => {
    const { ratings, total } = await ratingsRepo.listBySpot(Number(req.params.spotId), 10, 0);
    success(res, { reviews: ratings.map(formatReview), total });
  }));

  // Whether the current driver has a completed, unrated booking for this spot.
  router.get('/spots/:spotId/ratable-booking', asyncHandler(async (req, res) => {
    const booking = await ratingsRepo.findRatableBookingForSpot(req.dbUser.id, Number(req.params.spotId));
    success(res, {
      booking: booking ? { id: Number(booking.id), confirmation_code: booking.confirmation_code } : null,
    });
  }));

  // ── Host Routes ─────────────────────────────────────────────────────

  // List spots the current user owns or has been assigned to manage.
  router.get('/host/spots', asyncHandler(async (req, res) => {
    const spots = await hostRepo.listAccessibleSpots(req.dbUser.id);
    success(res, { spots: spots.map(formatSpotDetail) });
  }));

  // Create a new spot
  router.post('/host/spots', asyncHandler(async (req, res) => {
    const {
      lat,
      lng,
      address,
      pricePerHour,
      capacity = 1,
      covered = false,
      guarded = false,
      evCharging = false,
      accessInstructions = null,
      photos = [],
    } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);
    const price = Number(pricePerHour);
    const spaces = Number(capacity);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(price)) {
      throw new AppError('MISSING_PARAMS', 400, 'lat, lng, and pricePerHour required');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new AppError('INVALID_COORDS', 400, 'Valid map coordinates are required');
    }
    if (price <= 0 || spaces < 1 || !Number.isInteger(spaces)) {
      throw new AppError('INVALID_LISTING', 400, 'Price and capacity must be valid positive numbers');
    }

    const photoUrls = await storeSpotPhotos(photos, req.dbUser.id);

    const spot = await spotsRepo.create({
      ownerId: req.dbUser.id,
      lat: latitude,
      lng: longitude,
      address: address || null,
      pricePerHour: price,
      capacity: spaces,
      covered: toBoolean(covered),
      guarded: toBoolean(guarded),
      evCharging: toBoolean(evCharging),
      accessInstructions: accessInstructions || null,
      photos: photoUrls,
    });

    // Promote to host if currently driver
    if (req.dbUser.role === 'driver') {
      await usersRepo.setRole(req.tgUser.id, 'host');
      req.dbUser.role = 'host';
    }

    notifyAdminsOfSpotSubmission(spot, req.dbUser).catch((err) => {
      logger.warn('Admin spot submission notification failed', { error: err.message, spotId: spot.id });
    });

    logger.info('MiniApp spot created', { spotId: spot.id, ownerId: req.dbUser.id, status: spot.status });
    created(res, { spot: formatSpotDetail(spot), pendingApproval: true });
  }));

  // Update spot (price, availability)
  router.put('/host/spots/:id', asyncHandler(async (req, res) => {
    const spotId = Number(req.params.id);
    const { pricePerHour, isAvailable } = req.body;

    const spot = await hostRepo.getSpotAccess(spotId, req.dbUser.id);
    if (!spot) {
      throw new AppError('NOT_FOUND', 404, 'Spot not found');
    }
    if (!spot.can_manage_spots) {
      throw new AppError('HOST_PERMISSION_REQUIRED', 403, 'You cannot manage this spot');
    }

    let updated = spot;
    if (pricePerHour !== undefined) {
      updated = await spotsRepo.updatePrice(spotId, spot.owner_id, Number(pricePerHour)) || updated;
    }
    if (isAvailable !== undefined) {
      updated = await spotsRepo.setAvailability(spotId, spot.owner_id, !!isAvailable) || updated;
    }

    const refreshed = await hostRepo.getSpotAccess(spotId, req.dbUser.id);
    success(res, { spot: formatSpotDetail(refreshed || updated) });
  }));

  // Delete spot
  router.delete('/host/spots/:id', asyncHandler(async (req, res) => {
    const spot = await hostRepo.getSpotAccess(Number(req.params.id), req.dbUser.id);
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    if (!spot.is_owner) {
      throw new AppError('OWNER_REQUIRED', 403, 'Only the spot owner can delete a listing');
    }
    const removed = await spotsRepo.remove(Number(req.params.id), req.dbUser.id);
    if (!removed) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    success(res, { removed: true });
  }));

  // Bookings for a host's spot
  router.get('/host/spots/:id/bookings', asyncHandler(async (req, res) => {
    const spotId = Number(req.params.id);
    const spot = await hostRepo.getSpotAccess(spotId, req.dbUser.id);
    if (!spot) {
      throw new AppError('NOT_FOUND', 404, 'Spot not found');
    }
    if (!spot.can_manage_bookings) {
      throw new AppError('HOST_PERMISSION_REQUIRED', 403, 'You cannot manage bookings for this spot');
    }
    const bookings = await bookingsRepo.listBySpot(spotId, 20);
    success(res, { bookings: bookings.map(b => ({ ...formatBooking(b), driver_name: b.driver_name })) });
  }));

  // Host revenue dashboard: daily, weekly, monthly, custom range, by spot, recent paid bookings.
  router.get('/host/reports/revenue', asyncHandler(async (req, res) => {
    const capabilities = await hostRepo.getHostCapabilities(req.dbUser.id);
    if (!capabilities.can_view_reports) {
      throw new AppError('HOST_PERMISSION_REQUIRED', 403, 'You cannot view host reports');
    }

    const report = await hostRepo.getHostRevenueReport(req.dbUser.id, {
      startDate: parseReportStart(req.query.startDate),
      endDate: parseReportEnd(req.query.endDate),
      spotId: req.query.spotId ? Number(req.query.spotId) : null,
      interval: req.query.interval ? String(req.query.interval) : 'day',
    });

    success(res, { report: formatHostRevenueReport(report) });
  }));

  // Host booking history across all accessible spots.
  router.get('/host/bookings', asyncHandler(async (req, res) => {
    const result = await hostRepo.listHostBookingHistory(req.dbUser.id, {
      spotId: req.query.spotId ? Number(req.query.spotId) : null,
      status: req.query.status ? String(req.query.status) : null,
      startDate: parseReportStart(req.query.startDate),
      endDate: parseReportEnd(req.query.endDate),
      limit: clampInt(req.query.limit, 20, 1, 50),
      offset: clampInt(req.query.offset, 0, 0, 5000),
    });

    success(res, {
      bookings: result.bookings.map(formatHostBooking),
      pagination: pagination(result.total, result.limit, result.offset),
    });
  }));

  // Owner-only manager assignments.
  router.get('/host/managers', asyncHandler(async (req, res) => {
    await requireHostOwner(req.dbUser.id);
    const managers = await hostRepo.listManagers(req.dbUser.id);
    success(res, { managers: managers.map(formatHostManager) });
  }));

  router.post('/host/managers', asyncHandler(async (req, res) => {
    await requireHostOwner(req.dbUser.id);
    const managerIdentifier = firstNonEmpty(
      req.body?.managerIdentifier,
      req.body?.manager_username,
      req.body?.managerUsername,
      req.body?.username,
      req.body?.managerTelegramId,
      req.body?.manager_telegram_id,
      req.body?.telegramId,
      req.body?.telegram_id
    );
    if (!managerIdentifier) {
      throw new AppError('INVALID_MANAGER', 400, 'A manager username is required');
    }

    try {
      const manager = await hostRepo.assignManager({
        ownerId: req.dbUser.id,
        managerIdentifier,
        spotId: req.body?.spotId ? Number(req.body.spotId) : null,
        canManageBookings: req.body?.canManageBookings !== false,
        canManageSpots: req.body?.canManageSpots !== false,
        canViewReports: req.body?.canViewReports === true,
      });
      created(res, { manager: formatHostManager(manager) });
    } catch (err) {
      if (err.message === 'MANAGER_IDENTIFIER_REQUIRED') {
        throw new AppError('INVALID_MANAGER', 400, 'A manager username is required');
      }
      if (err.message === 'MANAGER_NOT_FOUND') {
        throw new AppError('MANAGER_NOT_FOUND', 404, 'That Telegram user must start the bot first and have a Telegram username.');
      }
      if (err.message === 'MANAGER_IS_OWNER') {
        throw new AppError('INVALID_MANAGER', 400, 'The owner cannot be assigned as their own manager');
      }
      if (err.message === 'SPOT_NOT_FOUND') {
        throw new AppError('NOT_FOUND', 404, 'Spot not found');
      }
      throw err;
    }
  }));

  router.put('/host/managers/:id', asyncHandler(async (req, res) => {
    await requireHostOwner(req.dbUser.id);
    const manager = await hostRepo.updateManager(req.dbUser.id, Number(req.params.id), {
      canManageBookings: req.body?.canManageBookings,
      canManageSpots: req.body?.canManageSpots,
      canViewReports: req.body?.canViewReports,
      isActive: req.body?.isActive,
    });
    if (!manager) throw new AppError('NOT_FOUND', 404, 'Manager assignment not found');
    success(res, { manager: formatHostManager(manager) });
  }));

  router.delete('/host/managers/:id', asyncHandler(async (req, res) => {
    await requireHostOwner(req.dbUser.id);
    const manager = await hostRepo.removeManager(req.dbUser.id, Number(req.params.id));
    if (!manager) throw new AppError('NOT_FOUND', 404, 'Manager assignment not found');
    success(res, { manager: formatHostManager(manager), removed: true });
  }));

  // Check in a driver by scanned QR token or typed confirmation code
  router.post('/host/checkin', asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const confirmationCode = String(req.body?.confirmationCode || req.body?.code || '').trim().toUpperCase();

    if (!token && !confirmationCode) {
      throw new AppError('MISSING_CHECKIN_REFERENCE', 400, 'QR token or confirmation code required');
    }

    try {
      const { booking } = token
        ? await checkIn({
          scannerTelegramId: req.tgUser.id,
          scannerRole: req.dbUser.role,
          token,
        })
        : await checkInByConfirmationCode({
          scannerTelegramId: req.tgUser.id,
          scannerRole: req.dbUser.role,
          confirmationCode,
        });

      success(res, { booking: formatBooking(booking), driver_name: booking.driver_name });
    } catch (err) {
      if (err instanceof CheckinError) {
        throw new AppError('CHECKIN_ERROR', 400, err.code);
      }
      throw err;
    }
  }));

  // Check in a driver (host action)
  router.post('/host/bookings/:id/checkin', asyncHandler(async (req, res) => {
    try {
      const { booking } = await checkInByBookingId({
        scannerTelegramId: req.tgUser.id,
        scannerRole: req.dbUser.role,
        bookingId: Number(req.params.id),
      });
      success(res, { booking: formatBooking(booking) });
    } catch (err) {
      if (err instanceof CheckinError) {
        throw new AppError('CHECKIN_ERROR', 400, err.code);
      }
      throw err;
    }
  }));

  // Complete a booking (host action)
  router.post('/host/bookings/:id/complete', asyncHandler(async (req, res) => {
    try {
      await completeBooking({
        scannerTelegramId: req.tgUser.id,
        scannerRole: req.dbUser.role,
        bookingId: Number(req.params.id),
      });
      success(res, { completed: true });
    } catch (err) {
      if (err instanceof CheckinError) {
        throw new AppError('CHECKIN_ERROR', 400, err.code);
      }
      throw err;
    }
  }));

  // ── Help / i18n ─────────────────────────────────────────────────────
  router.get('/help', asyncHandler(async (req, res) => {
    const lang = req.dbUser.language_pref || 'en';
    const t = getTranslator(lang);
    const capabilities = await hostRepo.getHostCapabilities(req.dbUser.id);
    const role = capabilities.has_host_access ? 'host' : (req.dbUser.role || 'driver');

    const categories = role === 'host'
      ? ['host_overview', 'host_listing', 'host_manage', 'host_handling', 'host_payments', 'host_faq', 'contact']
      : ['driver_overview', 'driver_find', 'driver_booking', 'driver_manage', 'driver_checkin', 'driver_host', 'driver_faq', 'contact'];

    const items = categories.map(key => ({
      key,
      title: t(`help.category.${key}`),
      content: t(`help.content.${key}`),
    }));

    success(res, { categories: items, bot_username: config.botUsername });
  }));

  // ── Admin Mini App ─────────────────────────────────────────────────
  router.use('/admin', requireMiniappAdmin);

  const adminReportHandler = asyncHandler(async (req, res) => {
    const params = parseAdminReportParams(req.query);
    const report = await adminAnalyticsRepo.getMiniappReport(params);
    success(res, { report: formatAdminReport(report, params) });
  });

  router.get('/admin/reports', adminReportHandler);
  router.get('/admin/reportes', adminReportHandler);

  router.get('/admin/overview', asyncHandler(async (_req, res) => {
    const [overview, bookingStats, paymentStats, activity, topSpots] = await Promise.all([
      adminAnalyticsRepo.getPlatformStats(),
      adminAnalyticsRepo.getBookingStats(),
      adminAnalyticsRepo.getPaymentMethodStats(),
      adminAnalyticsRepo.getRecentActivity(8),
      adminAnalyticsRepo.getTopSpots(5),
    ]);

    success(res, {
      overview: formatAdminOverview(overview),
      bookings: bookingStats.map(formatCountRow),
      payments: paymentStats.map(formatPaymentStat),
      activity: activity.map(formatActivity),
      top_spots: topSpots.map(formatAdminSpotSummary),
    });
  }));

  router.get('/admin/workspace', asyncHandler(async (_req, res) => {
    const [overview, pendingSpots, tickets, disputes, payments, bookings, balances, users] = await Promise.all([
      adminAnalyticsRepo.getPlatformStats(),
      adminSpotsRepo.listAll({ status: 'pending_approval', limit: 5, offset: 0 }),
      adminTicketsRepo.listAll({ status: 'open', limit: 5, offset: 0 }),
      adminFinanceRepo.listDisputes({ status: 'open', limit: 5, offset: 0 }),
      adminBookingsRepo.listPayments({ status: 'awaiting_review', limit: 5, offset: 0 }),
      adminBookingsRepo.listAll({ limit: 5, offset: 0 }),
      adminFinanceRepo.getHostBalances(),
      adminUsersRepo.listAll({ limit: 5, offset: 0 }),
    ]);

    success(res, {
      overview: formatAdminOverview(overview),
      queues: {
        pending_spots: {
          total: pendingSpots.total,
          items: pendingSpots.spots.map(formatAdminSpot),
        },
        open_tickets: {
          total: tickets.total,
          items: tickets.tickets.map(formatAdminTicket),
        },
        open_disputes: {
          total: disputes.total,
          items: disputes.disputes.map(formatAdminDispute),
        },
        payment_review: {
          total: payments.total,
          items: payments.payments.map(formatAdminPayment),
        },
        recent_bookings: {
          total: bookings.total,
          items: bookings.bookings.map(formatAdminBooking),
        },
        host_balances: {
          total: balances.length,
          items: balances.slice(0, 5).map(formatHostBalance),
        },
        recent_users: {
          total: users.total,
          items: users.users.map(formatAdminUser),
        },
      },
    });
  }));

  router.get('/admin/spots', asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminSpotsRepo.listAll({ status, limit, offset });
    success(res, { items: result.spots.map(formatAdminSpot), pagination: pagination(result.total, limit, offset) });
  }));

  router.post('/admin/spots/:id/approve', asyncHandler(async (req, res) => {
    const spot = await adminSpotsRepo.approve(Number(req.params.id), null);
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    logger.info('Miniapp admin spot approved', { spotId: spot.id, adminUserId: req.dbUser.id });
    success(res, { spot: formatAdminSpot(spot) });
  }));

  router.post('/admin/spots/:id/reject', asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    const spot = await adminSpotsRepo.reject(Number(req.params.id), reason || null, null);
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    logger.info('Miniapp admin spot rejected', { spotId: spot.id, adminUserId: req.dbUser.id });
    success(res, { spot: formatAdminSpot(spot) });
  }));

  router.post('/admin/spots/:id/suspend', asyncHandler(async (req, res) => {
    const spot = await adminSpotsRepo.suspend(Number(req.params.id));
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    logger.info('Miniapp admin spot suspended', { spotId: spot.id, adminUserId: req.dbUser.id });
    success(res, { spot: formatAdminSpot(spot) });
  }));

  router.post('/admin/spots/:id/reactivate', asyncHandler(async (req, res) => {
    const spot = await adminSpotsRepo.reactivate(Number(req.params.id));
    if (!spot) throw new AppError('NOT_FOUND', 404, 'Spot not found');
    logger.info('Miniapp admin spot reactivated', { spotId: spot.id, adminUserId: req.dbUser.id });
    success(res, { spot: formatAdminSpot(spot) });
  }));

  router.get('/admin/tickets', asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminTicketsRepo.listAll({ status, category, search, limit, offset });
    success(res, { items: result.tickets.map(formatAdminTicket), pagination: pagination(result.total, limit, offset) });
  }));

  router.get('/admin/tickets/:id', asyncHandler(async (req, res) => {
    const ticket = await adminTicketsRepo.getById(Number(req.params.id));
    if (!ticket) throw new AppError('NOT_FOUND', 404, 'Ticket not found');
    success(res, { ticket: formatAdminTicketDetail(ticket) });
  }));

  router.post('/admin/tickets/:id/status', asyncHandler(async (req, res) => {
    const status = String(req.body?.status || '').trim();
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      throw new AppError('INVALID_TICKET_STATUS', 400, 'Choose a valid ticket status');
    }
    const ticket = await adminTicketsRepo.updateStatus(Number(req.params.id), status, {
      adminNotes: req.body?.adminNotes,
    });
    if (!ticket) throw new AppError('NOT_FOUND', 404, 'Ticket not found');
    logger.info('Miniapp admin ticket status updated', { ticketId: ticket.id, status, adminUserId: req.dbUser.id });
    success(res, { ticket: formatAdminTicket(ticket) });
  }));

  router.post('/admin/tickets/:id/reply', asyncHandler(async (req, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw new AppError('INVALID_REPLY', 400, 'Reply message is required');
    if (message.length > 2000) throw new AppError('INVALID_REPLY', 400, 'Reply message is too long');

    const ticket = await adminTicketsRepo.getById(Number(req.params.id));
    if (!ticket) throw new AppError('NOT_FOUND', 404, 'Ticket not found');
    const reply = await adminTicketsRepo.addReply({
      ticketId: ticket.id,
      userId: req.dbUser.id,
      message,
      isFromAdmin: true,
    });
    await adminTicketsRepo.updateStatus(ticket.id, 'in_progress');
    if (ticket.user_telegram_id) {
      try {
        const bot = getBot();
        await sendTicketReplyNotification(bot, ticket, reply);
      } catch (err) {
        logger.warn('Miniapp admin ticket reply notification failed', { ticketId: ticket.id, error: err.message });
      }
    }
    logger.info('Miniapp admin ticket reply added', { ticketId: ticket.id, adminUserId: req.dbUser.id });
    const updated = await adminTicketsRepo.getById(ticket.id);
    success(res, { ticket: formatAdminTicketDetail(updated) });
  }));

  router.get('/admin/bookings', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminBookingsRepo.listAll({
      status: req.query.status ? String(req.query.status) : undefined,
      paymentStatus: req.query.paymentStatus ? String(req.query.paymentStatus) : undefined,
      dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
      dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
      limit,
      offset,
    });
    success(res, { items: result.bookings.map(formatAdminBooking), pagination: pagination(result.total, limit, offset) });
  }));

  router.post('/admin/bookings/:id/cancel', asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    const booking = await adminBookingsRepo.cancel(Number(req.params.id), reason || 'Cancelled by admin');
    if (!booking) throw new AppError('NOT_FOUND', 404, 'Booking not found');
    logger.info('Miniapp admin booking cancelled', { bookingId: booking.id, adminUserId: req.dbUser.id });
    success(res, { booking: formatAdminBooking(booking) });
  }));

  router.get('/admin/users', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminUsersRepo.listAll({
      role: req.query.role ? String(req.query.role) : undefined,
      isBanned: req.query.isBanned !== undefined ? String(req.query.isBanned) === 'true' : undefined,
      limit,
      offset,
    });
    success(res, { items: result.users.map(formatAdminUser), pagination: pagination(result.total, limit, offset) });
  }));

  router.post('/admin/users/:id/ban', asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || '').trim();
    const user = await adminUsersRepo.ban(Number(req.params.id), reason || null);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    logger.info('Miniapp admin user banned', { userId: user.id, adminUserId: req.dbUser.id });
    success(res, { user: formatAdminUser(user) });
  }));

  router.post('/admin/users/:id/unban', asyncHandler(async (req, res) => {
    const user = await adminUsersRepo.unban(Number(req.params.id));
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    logger.info('Miniapp admin user unbanned', { userId: user.id, adminUserId: req.dbUser.id });
    success(res, { user: formatAdminUser(user) });
  }));

  router.put('/admin/users/:id/role', asyncHandler(async (req, res) => {
    const role = String(req.body?.role || '').trim();
    if (!['driver', 'host', 'admin'].includes(role)) {
      throw new AppError('INVALID_ROLE', 400, 'Role must be driver, host, or admin');
    }
    const user = await adminUsersRepo.setRole(Number(req.params.id), role);
    if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
    logger.info('Miniapp admin user role changed', { userId: user.id, role, adminUserId: req.dbUser.id });
    success(res, { user: formatAdminUser(user) });
  }));

  router.get('/admin/payments', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminBookingsRepo.listPayments({
      status: req.query.status ? String(req.query.status) : undefined,
      method: req.query.method ? String(req.query.method) : undefined,
      limit,
      offset,
    });
    success(res, { items: result.payments.map(formatAdminPayment), pagination: pagination(result.total, limit, offset) });
  }));

  router.get('/admin/payments/:id', asyncHandler(async (req, res) => {
    const payment = await adminBookingsRepo.getPaymentById(Number(req.params.id));
    if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment not found');
    success(res, { payment: formatAdminPaymentDetail(payment) });
  }));

  router.post('/admin/payments/:id/refund', asyncHandler(async (req, res) => {
    const payment = await adminBookingsRepo.refundPayment(Number(req.params.id));
    if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment not found');
    logger.info('Miniapp admin payment refunded', { paymentId: payment.id, adminUserId: req.dbUser.id });
    success(res, { payment: formatAdminPayment(payment) });
  }));

  router.get('/admin/finance/balances', asyncHandler(async (_req, res) => {
    const balances = await adminFinanceRepo.getHostBalances();
    success(res, { items: balances.map(formatHostBalance) });
  }));

  router.post('/admin/finance/payouts', asyncHandler(async (req, res) => {
    const hostId = Number(req.body?.hostId);
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note || '').trim();
    if (!Number.isInteger(hostId) || hostId <= 0) throw new AppError('INVALID_HOST', 400, 'Host ID is required');
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('INVALID_AMOUNT', 400, 'Amount must be greater than 0');
    const payout = await adminFinanceRepo.createPayout({ hostId, amount, note, markedBy: null });
    logger.info('Miniapp admin payout created', { payoutId: payout.id, adminUserId: req.dbUser.id });
    created(res, { payout: formatPayout(payout) });
  }));

  router.post('/admin/finance/payouts/:id/sent', asyncHandler(async (req, res) => {
    const payout = await adminFinanceRepo.markPayoutSent(Number(req.params.id));
    if (!payout) throw new AppError('NOT_FOUND', 404, 'Payout not found');
    logger.info('Miniapp admin payout marked sent', { payoutId: payout.id, adminUserId: req.dbUser.id });
    success(res, { payout: formatPayout(payout) });
  }));

  router.get('/admin/disputes', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 5000);
    const result = await adminFinanceRepo.listDisputes({
      status: req.query.status ? String(req.query.status) : undefined,
      limit,
      offset,
    });
    success(res, { items: result.disputes.map(formatAdminDispute), pagination: pagination(result.total, limit, offset) });
  }));

  router.post('/admin/disputes/:id/resolve', asyncHandler(async (req, res) => {
    const resolution = String(req.body?.resolution || '').trim();
    if (!resolution) throw new AppError('INVALID_RESOLUTION', 400, 'Resolution is required');
    const dispute = await adminFinanceRepo.resolveDispute(Number(req.params.id), resolution, null);
    if (!dispute) throw new AppError('NOT_FOUND', 404, 'Dispute not found');
    logger.info('Miniapp admin dispute resolved', { disputeId: dispute.id, adminUserId: req.dbUser.id });
    success(res, { dispute: formatAdminDispute(dispute) });
  }));

  router.post('/admin/disputes/:id/reject', asyncHandler(async (req, res) => {
    const resolution = String(req.body?.resolution || '').trim();
    if (!resolution) throw new AppError('INVALID_RESOLUTION', 400, 'Resolution is required');
    const dispute = await adminFinanceRepo.rejectDispute(Number(req.params.id), resolution, null);
    if (!dispute) throw new AppError('NOT_FOUND', 404, 'Dispute not found');
    logger.info('Miniapp admin dispute rejected', { disputeId: dispute.id, adminUserId: req.dbUser.id });
    success(res, { dispute: formatAdminDispute(dispute) });
  }));

  // ── Support Tickets ─────────────────────────────────────────────────
  router.get('/support/tickets', asyncHandler(async (req, res) => {
    const limit = clampInt(req.query.limit, 5, 1, 20);
    const tickets = await supportTicketsRepo.listByUser(req.dbUser.id, limit);
    success(res, { tickets: tickets.map(formatSupportTicket) });
  }));

  router.post('/support/tickets', asyncHandler(async (req, res) => {
    const category = String(req.body?.category || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!SUPPORT_CATEGORIES.has(category)) {
      throw new AppError('INVALID_TICKET_CATEGORY', 400, 'Choose a valid support category');
    }
    if (description.length < 10) {
      throw new AppError('INVALID_TICKET_DESCRIPTION', 400, 'Describe the issue in at least 10 characters');
    }
    if (description.length > 1000) {
      throw new AppError('INVALID_TICKET_DESCRIPTION', 400, 'Keep the description under 1000 characters');
    }

    const autoCategory = predictCategoryKey(description);
    const ticket = await supportTicketsRepo.create({
      userId: req.dbUser.id,
      category,
      description,
      screenshotFileId: null,
      autoCategory,
    });

    logger.info('Miniapp support ticket created', {
      ticketId: ticket.id,
      userId: req.dbUser.id,
      category,
      autoCategory,
    });

    created(res, { ticket: formatSupportTicket({ ...ticket, reply_count: 0 }) });
  }));

  return router;
}

// ── Formatting helpers ──────────────────────────────────────────────────

function formatSpot(s) {
  return {
    id: Number(s.id),
    address: s.address,
    price_per_hour: Number(s.price_per_hour),
    lat: Number(s.lat),
    lng: Number(s.lng),
    distance_m: s.distance_m != null ? Math.round(Number(s.distance_m)) : null,
    rating_avg: Number(s.rating_avg) || 0,
    rating_count: Number(s.rating_count) || 0,
    capacity: Number(s.capacity) || 1,
    occupied_spaces: Number(s.occupied_spaces) || 0,
    available_spaces: s.available_spaces != null ? Number(s.available_spaces) : null,
    is_full_now: !!s.is_full_now,
    covered: s.covered,
    guarded: s.guarded,
    ev_charging: s.ev_charging,
  };
}

function formatSpotDetail(s) {
  return {
    ...formatSpot(s),
    owner_id: s.owner_id != null ? Number(s.owner_id) : null,
    capacity: Number(s.capacity) || 1,
    is_available: s.is_available,
    status: s.status,
    photos: s.photos || [],
    access_instructions: s.access_instructions || null,
    rejection_reason: s.rejection_reason || null,
    approved_at: s.approved_at || null,
    rejected_at: s.rejected_at || null,
    created_at: s.created_at,
    host_access_role: s.host_access_role || null,
    is_owner: s.is_owner === true,
    can_manage_spots: s.can_manage_spots === true,
    can_manage_bookings: s.can_manage_bookings === true,
    can_view_reports: s.can_view_reports === true,
  };
}

function formatReview(r) {
  return {
    id: Number(r.id),
    score: Number(r.score),
    comment: r.comment || null,
    driver_name: r.driver_name || 'Driver',
    created_at: r.created_at,
  };
}

function formatBookingPayment(b) {
  if (!b.payment_id) return null;
  return {
    id: b.payment_id,
    method: b.payment_method,
    status: b.payment_record_status,
    checkout_url: b.payment_checkout_url,
  };
}

function formatPayment(p) {
  return {
    id: p.id,
    booking_id: p.booking_id,
    method: p.method,
    amount: Number(p.amount),
    status: p.status,
    reference: p.reference,
    checkout_url: p.checkout_url,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

function formatBooking(b) {
  return {
    id: b.id,
    spot_id: b.spot_id,
    driver_id: b.driver_id,
    confirmation_code: b.confirmation_code,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    total_price: Number(b.total_price),
    payment_status: b.payment_status,
    payment: formatBookingPayment(b),
    address: b.address,
    vehicle_id: b.vehicle_id,
    created_at: b.created_at,
    checkin_token: b.checkin_token,
  };
}

function formatHostBooking(b) {
  return {
    ...formatBooking(b),
    driver_name: b.driver_name || null,
    payment_id: b.payment_id || null,
    payment_method: b.payment_method || null,
    payment_record_status: b.payment_record_status || null,
    payment_amount: Number(b.payment_amount || 0),
    host_payout_amount: Number(b.host_payout_amount || 0),
    commission_amount: Number(b.commission_amount || 0),
  };
}

function formatHostRevenueReport(report = {}) {
  return {
    summary: {
      gross_revenue: Number(report.summary?.gross_revenue || 0),
      host_earnings: Number(report.summary?.host_earnings || 0),
      commission: Number(report.summary?.commission || 0),
      paid_bookings: Number(report.summary?.paid_bookings || 0),
    },
    presets: {
      today: {
        earnings: Number(report.presets?.today?.earnings || 0),
        bookings: Number(report.presets?.today?.bookings || 0),
      },
      week: {
        earnings: Number(report.presets?.week?.earnings || 0),
        bookings: Number(report.presets?.week?.bookings || 0),
      },
      month: {
        earnings: Number(report.presets?.month?.earnings || 0),
        bookings: Number(report.presets?.month?.bookings || 0),
      },
    },
    by_spot: (report.by_spot || []).map(row => ({
      id: Number(row.id),
      address: row.address,
      paid_bookings: Number(row.paid_bookings || 0),
      gross_revenue: Number(row.gross_revenue || 0),
      host_earnings: Number(row.host_earnings || 0),
    })),
    timeline: (report.timeline || []).map(row => ({
      bucket: row.bucket,
      paid_bookings: Number(row.paid_bookings || 0),
      gross_revenue: Number(row.gross_revenue || 0),
      host_earnings: Number(row.host_earnings || 0),
    })),
    recent_bookings: (report.recent_bookings || []).map(row => ({
      id: Number(row.id),
      spot_id: Number(row.spot_id),
      confirmation_code: row.confirmation_code,
      address: row.address,
      driver_name: row.driver_name || null,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      payment_status: row.payment_status,
      amount: Number(row.amount || 0),
      host_payout_amount: Number(row.host_payout_amount || 0),
      commission_amount: Number(row.commission_amount || 0),
      paid_at: row.paid_at,
    })),
  };
}

function formatHostManager(manager = {}) {
  return {
    id: Number(manager.id),
    owner_id: Number(manager.owner_id),
    manager_id: Number(manager.manager_id),
    manager_name: manager.manager_name || null,
    manager_username: manager.manager_username || null,
    manager_telegram_id: manager.manager_telegram_id != null ? Number(manager.manager_telegram_id) : null,
    spot_id: manager.spot_id != null ? Number(manager.spot_id) : null,
    spot_address: manager.spot_address || null,
    can_manage_bookings: manager.can_manage_bookings === true,
    can_manage_spots: manager.can_manage_spots === true,
    can_view_reports: manager.can_view_reports === true,
    is_active: manager.is_active === true,
    created_at: manager.created_at,
    updated_at: manager.updated_at,
  };
}

function parseReportStart(value) {
  if (!value) return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new AppError('INVALID_DATE', 400, 'Invalid report startDate');
  }
  return date.toISOString();
}

function parseReportEnd(value) {
  if (!value) return null;
  const raw = String(value);
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new AppError('INVALID_DATE', 400, 'Invalid report endDate');
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString();
}

function requireMiniappAdmin(req, _res, next) {
  if (req.dbUser?.role !== 'admin') {
    throw new AppError('ADMIN_REQUIRED', 403, 'Admin access is required');
  }
  next();
}

async function requireHostOwner(userId) {
  const capabilities = await hostRepo.getHostCapabilities(userId);
  if (!capabilities.owns_spots) {
    throw new AppError('OWNER_REQUIRED', 403, 'Only a parking owner can manage team access');
  }
}

function pagination(total, limit, offset) {
  return {
    total: Number(total || 0),
    limit,
    offset,
    has_more: offset + limit < Number(total || 0),
  };
}

function parseAdminReportParams(query) {
  const type = ADMIN_REPORT_TYPES.has(String(query.type || '')) ? String(query.type) : 'payments';
  const interval = ADMIN_REPORT_INTERVALS.has(String(query.interval || '')) ? String(query.interval) : 'day';
  const limit = clampInt(query.limit, 8, 3, 20);

  const now = new Date();
  const fallbackStart = new Date(now);
  fallbackStart.setDate(now.getDate() - 30);
  fallbackStart.setHours(0, 0, 0, 0);

  const start = parseReportDate(query.startDate, fallbackStart, { endOfDay: false });
  const inclusiveEnd = parseReportDate(query.endDate, now, { endOfDay: true });

  if (inclusiveEnd < start) {
    throw new AppError('INVALID_REPORT_RANGE', 400, 'Report end date must be after start date');
  }

  const endExclusive = new Date(inclusiveEnd);
  endExclusive.setDate(endExclusive.getDate() + 1);
  endExclusive.setHours(0, 0, 0, 0);

  return {
    type,
    interval,
    limit,
    startDate: start.toISOString(),
    endDate: endExclusive.toISOString(),
    displayStartDate: dateOnly(start),
    displayEndDate: dateOnly(inclusiveEnd),
  };
}

function parseReportDate(value, fallback, { endOfDay }) {
  if (!value) return new Date(fallback);
  const text = String(value);
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    parsed.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return parsed;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('INVALID_REPORT_DATE', 400, 'Use a valid report date');
  }
  return parsed;
}

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAdminOverview(row = {}) {
  return {
    total_users: Number(row.total_users || 0),
    active_spots: Number(row.active_spots || 0),
    pending_spots: Number(row.pending_spots || 0),
    total_bookings: Number(row.total_bookings || 0),
    active_bookings: Number(row.active_bookings || 0),
    total_revenue: Number(row.total_revenue || 0),
    pending_payouts: Number(row.pending_payouts || 0),
    open_tickets: Number(row.open_tickets || 0),
    open_disputes: Number(row.open_disputes || 0),
  };
}

function formatAdminReport(report = {}, params = {}) {
  return {
    type: report.type || params.type,
    range: {
      start_date: params.displayStartDate,
      end_date: params.displayEndDate,
      interval: report.range?.interval || params.interval,
    },
    summary: formatNumberObject(report.summary || {}),
    trend: (report.trend || []).map(formatNumberObject),
    breakdowns: Object.fromEntries(
      Object.entries(report.breakdowns || {}).map(([key, rows]) => [
        key,
        (rows || []).map(formatNumberObject),
      ])
    ),
    top_spots: (report.top_spots || []).map(formatNumberObject),
    rows: (report.rows || []).map(formatNumberObject),
  };
}

function formatNumberObject(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === 'bigint') return [key, Number(value)];
      if (value instanceof Date) return [key, value.toISOString()];
      if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value)) {
        return [key, Number(value)];
      }
      return [key, value];
    })
  );
}

function formatCountRow(row = {}) {
  return { status: row.status, count: Number(row.count || 0) };
}

function formatPaymentStat(row = {}) {
  return {
    method: row.method,
    status: row.status,
    count: Number(row.count || 0),
    total_amount: Number(row.total_amount || 0),
  };
}

function formatActivity(row = {}) {
  return {
    type: row.type,
    id: Number(row.id),
    status: row.status,
    reference: row.reference || null,
    details: row.details || null,
    created_at: row.created_at,
  };
}

function formatAdminSpotSummary(row = {}) {
  return {
    id: Number(row.id),
    address: row.address,
    price_per_hour: Number(row.price_per_hour || 0),
    rating_avg: Number(row.rating_avg || 0),
    rating_count: Number(row.rating_count || 0),
    booking_count: Number(row.booking_count || 0),
    total_revenue: Number(row.total_revenue || 0),
  };
}

function formatAdminSpot(row = {}) {
  return {
    id: Number(row.id),
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    owner_name: row.owner_name || null,
    owner_telegram_id: row.owner_telegram_id || null,
    address: row.address,
    price_per_hour: Number(row.price_per_hour || 0),
    capacity: Number(row.capacity || 0),
    occupied_spaces: Number(row.occupied_spaces || 0),
    available_spaces: Number(row.available_spaces || 0),
    status: row.status,
    is_available: row.is_available,
    rating_avg: Number(row.rating_avg || 0),
    rating_count: Number(row.rating_count || 0),
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    rejection_reason: row.rejection_reason || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatAdminTicket(row = {}) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    user_name: row.user_name || null,
    user_telegram_id: row.user_telegram_id || null,
    category: row.category,
    auto_category: row.auto_category || null,
    description: row.description,
    status: row.status,
    assigned_admin_name: row.assigned_admin_name || null,
    reply_count: Number(row.reply_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatAdminTicketDetail(ticket = {}) {
  return {
    ...formatAdminTicket(ticket),
    admin_notes: ticket.admin_notes || null,
    replies: (ticket.replies || []).map((reply) => ({
      id: Number(reply.id),
      message: reply.message,
      is_from_admin: reply.is_from_admin,
      admin_name: reply.admin_name || null,
      created_at: reply.created_at,
    })),
  };
}

function formatAdminBooking(row = {}) {
  return {
    id: Number(row.id),
    spot_id: row.spot_id != null ? Number(row.spot_id) : null,
    driver_id: row.driver_id != null ? Number(row.driver_id) : null,
    driver_name: row.driver_name || null,
    driver_telegram_id: row.driver_telegram_id || null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    address: row.address || null,
    confirmation_code: row.confirmation_code || null,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    total_price: Number(row.total_price || 0),
    payment_status: row.payment_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatAdminUser(row = {}) {
  return {
    id: Number(row.id),
    telegram_id: row.telegram_id,
    name: row.name || null,
    username: row.username || null,
    phone: row.phone || null,
    role: row.role,
    language_pref: row.language_pref,
    is_banned: !!row.is_banned,
    ban_reason: row.ban_reason || null,
    total_bookings: row.total_bookings != null ? Number(row.total_bookings) : undefined,
    completed_bookings: row.completed_bookings != null ? Number(row.completed_bookings) : undefined,
    created_at: row.created_at,
  };
}

function formatAdminPayment(row = {}) {
  return {
    id: Number(row.id),
    booking_id: row.booking_id != null ? Number(row.booking_id) : null,
    method: row.method,
    amount: Number(row.amount || 0),
    commission_amount: Number(row.commission_amount || 0),
    host_payout_amount: Number(row.host_payout_amount || 0),
    status: row.status,
    reference: row.reference || null,
    confirmation_code: row.confirmation_code || null,
    address: row.address || null,
    driver_name: row.driver_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatAdminPaymentDetail(row = {}) {
  return {
    ...formatAdminPayment(row),
    booking_status: row.booking_status || null,
    booking_payment_status: row.booking_payment_status || null,
    booking_total_price: Number(row.booking_total_price || 0),
    spot_id: row.spot_id != null ? Number(row.spot_id) : null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    owner_name: row.owner_name || null,
    owner_telegram_id: row.owner_telegram_id || null,
    driver_telegram_id: row.driver_telegram_id || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
  };
}

function formatHostBalance(row = {}) {
  return {
    host_id: Number(row.host_id),
    host_name: row.host_name || null,
    owner_telegram_id: row.owner_telegram_id || null,
    total_earned: Number(row.total_earned || 0),
    total_paid: Number(row.total_paid || 0),
    balance: Number(row.balance || row.balance_due || row.amount_due || 0),
  };
}

function formatPayout(row = {}) {
  return {
    id: Number(row.id),
    host_id: Number(row.host_id),
    amount: Number(row.amount || 0),
    status: row.status,
    note: row.note || null,
    sent_at: row.sent_at || null,
    created_at: row.created_at,
  };
}

function formatAdminDispute(row = {}) {
  return {
    id: Number(row.id),
    booking_id: row.booking_id != null ? Number(row.booking_id) : null,
    raised_by: row.raised_by != null ? Number(row.raised_by) : null,
    raised_by_name: row.raised_by_name || null,
    raised_by_telegram_id: row.raised_by_telegram_id || null,
    confirmation_code: row.confirmation_code || null,
    address: row.address || null,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatSupportTicket(ticket) {
  return {
    id: Number(ticket.id),
    category: ticket.category,
    auto_category: ticket.auto_category || null,
    description: ticket.description,
    status: ticket.status,
    reply_count: Number(ticket.reply_count || 0),
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    resolved_at: ticket.resolved_at || null,
  };
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function clampInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}

function parseCoords(query, { required }) {
  const hasLat = query.lat !== undefined && query.lat !== null && query.lat !== '';
  const hasLng = query.lng !== undefined && query.lng !== null && query.lng !== '';

  if (!hasLat && !hasLng && !required) {
    return { lat: null, lng: null, hasCoords: false };
  }

  if (!hasLat || !hasLng) {
    throw new AppError('MISSING_PARAMS', 400, 'lat and lng are required');
  }

  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('INVALID_COORDS', 400, 'Valid lat and lng are required');
  }

  return { lat, lng, hasCoords: true };
}

function parseDataUrlImage(image) {
  if (typeof image !== 'string') return null;
  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_SPOT_PHOTO_BYTES) return null;
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  return { buffer, ext };
}

async function storeSpotPhotos(photoData = [], ownerId) {
  const photos = [];
  const incoming = Array.isArray(photoData) ? photoData.slice(0, MAX_SPOT_PHOTOS) : [];
  if (!incoming.length) return photos;
  await mkdir(spotUploadDir, { recursive: true });

  for (const image of incoming) {
    const parsed = parseDataUrlImage(image);
    if (!parsed) continue;
    const filename = Date.now() + '-' + ownerId + '-' + crypto.randomUUID() + parsed.ext;
    await writeFile(join(spotUploadDir, filename), parsed.buffer);
    photos.push('/uploads/spots/' + filename);
  }

  return photos;
}

async function notifyAdminsOfSpotSubmission(spot, host) {
  let bot;
  try {
    bot = getBot();
  } catch {
    return;
  }

  let admins = [];
  try {
    admins = await usersRepo.listAdmins();
  } catch (err) {
    logger.warn('Failed to load admin users for spot notification', { error: err.message });
    return;
  }

  const baseUrl = config.publicUrl.replace(/\/+$/, '');
  const adminUrl = baseUrl + '/admin/spots';
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + spot.lat + ',' + spot.lng;
  const hostLabel = host.name || host.username || host.telegram_id || host.id;
  const text = [
    '*New parking spot pending approval*',
    'Spot #' + spot.id + ': ' + (spot.address || 'No address'),
    'Host: ' + hostLabel,
    'Capacity: ' + spot.capacity + ' spaces',
    'Price: ' + Number(spot.price_per_hour) + ' ' + currency + '/hr',
    'Map: ' + mapUrl,
    'Review: ' + adminUrl,
  ].join('\n');

  await Promise.allSettled(
    admins.map((admin) => bot.api.sendMessage(Number(admin.telegram_id), text, { parse_mode: 'Markdown' }))
  );
}
