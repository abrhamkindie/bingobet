/**
 * Zod validation schemas for all API route inputs.
 *
 * Each schema validates one input source: body, query, or params.
 * Use with the `validate()` middleware from middlewares/validate.js.
 *
 * Example:
 *   router.post('/login', validate({ body: schemas.login }), handler);
 *   router.get('/spots', validate({ query: schemas.pagination }), handler);
 *   router.get('/spots/:id', validate({ params: schemas.idParam }), handler);
 *
 * @module schemas
 */

import { z } from 'zod';

// ── Shared primitives ──────────────────────────────────────────────────────

/**
 * Generic ID path parameter — coerces a string path segment to a positive integer.
 * @example { id: "42" } → { id: 42 }
 */
export const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Spot ID path parameter — for nested routes like /ratings/stats/spot/:spotId.
 * @example { spotId: "7" } → { spotId: 7 }
 */
export const spotIdParam = z.object({
  spotId: z.coerce.number().int().positive(),
});

/**
 * @typedef {Object} PaginationFields
 * @property {number} limit - Results per page (1–100, default 20)
 * @property {number} offset - Offset from start (0+, default 0)
 */

/** @type {PaginationFields} Standard pagination query params, spread into list schemas. */
export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

// ── Auth ───────────────────────────────────────────────────────────────────

/** Validates POST /api/admin/login body: email + password. */
export const login = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

/** Validates POST /api/admin/register body: email, password (min 6), optional name and role. */
export const register = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  role: z.enum(['admin', 'superadmin']).optional(),
});

// ── Public ─────────────────────────────────────────────────────────────────

/** Validates GET /api/spots/nearby query: lat (±90), lng (±180), optional radius (meters). */
export const nearbySpots = z.object({
  lat: z.coerce.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  radius: z.coerce.number().int().positive().optional(),
});

// ── Admin: Spots ──────────────────────────────────────────────────────────

/** Validates GET /api/admin/spots query: optional status filter + pagination. */
export const spotListQuery = z.object({
  status: z.string().optional(),
  ...pagination,
});

/** Validates POST /api/admin/spots/:id/reject body: optional reason. */
export const rejectSpotBody = z.object({
  reason: z.string().optional(),
});

/** Validates PUT /api/admin/spots/:id/price body: price must be positive and ≤ 999,999. */
export const updateSpotPriceBody = z.object({
  price: z.coerce.number().positive('Price must be greater than 0').max(999999),
});

/** Validates POST /api/admin/spots body: create a new spot. */
export const createSpotBody = z.object({
  ownerId: z.coerce.number().int().positive('Owner ID is required'),
  address: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  pricePerHour: z.coerce.number().positive().max(999999),
  capacity: z.coerce.number().int().min(1).default(1),
  covered: z.boolean().optional(),
  guarded: z.boolean().optional(),
  evCharging: z.boolean().optional(),
  accessInstructions: z.string().optional(),
  photos: z.array(z.string()).optional(),
  status: z.string().optional(),
  isAvailable: z.boolean().optional(),
});

/** Validates PUT /api/admin/spots/:id body: update spot fields. */
export const updateSpotBody = z.object({
  address: z.string().optional(),
  price_per_hour: z.coerce.number().positive().max(999999).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  covered: z.boolean().optional(),
  guarded: z.boolean().optional(),
  ev_charging: z.boolean().optional(),
  access_instructions: z.string().optional(),
  photos: z.array(z.string()).optional(),
  status: z.string().optional(),
  is_available: z.boolean().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field to update is required' });

// ── Admin: Bookings ────────────────────────────────────────────────────────

/** Validates GET /api/admin/bookings query: optional status, paymentStatus, date range + pagination. */
export const bookingListQuery = z.object({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  ...pagination,
});

/** Validates POST /api/admin/bookings/:id/cancel body: optional reason. */
export const cancelBookingBody = z.object({
  reason: z.string().optional(),
});

// ── Admin: Payments ────────────────────────────────────────────────────────

/** Validates GET /api/admin/payments query: optional status, payment method filter + pagination. */
export const paymentListQuery = z.object({
  status: z.string().optional(),
  method: z.string().optional(),
  ...pagination,
});

// ── Admin: Finance ─────────────────────────────────────────────────────────

/** Validates POST /api/admin/finance/payouts body: host ID (required), amount (positive), optional note. */
export const createPayoutBody = z.object({
  hostId: z.coerce.number().int().positive('Host ID is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  note: z.string().optional(),
});

// ── Admin: Users ───────────────────────────────────────────────────────────

/** Validates GET /api/admin/users query: optional role, isBanned filter + pagination. */
export const userListQuery = z.object({
  role: z.string().optional(),
  isBanned: z.string().optional(),
  ...pagination,
});

/** Validates POST /api/admin/users/:id/ban body: optional reason. */
export const banUserBody = z.object({
  reason: z.string().optional(),
});

/** Validates POST /api/admin/users body: create a new user. */
export const createUserBody = z.object({
  telegramId: z.coerce.number().int().positive('Telegram ID is required'),
  name: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['driver', 'host', 'admin']).optional(),
  languagePref: z.enum(['en', 'am']).optional(),
});

/** Validates PUT /api/admin/users/:id body: update user fields. */
export const updateUserBody = z.object({
  name: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['driver', 'host', 'admin']).optional(),
  language_pref: z.enum(['en', 'am']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field to update is required' });

/** Validates PUT /api/admin/users/:id/role body: role must be one of driver, host, or admin. */
export const setUserRoleBody = z.object({
  role: z.enum(['driver', 'host', 'admin'], {
    errorMap: () => ({ message: 'Role must be driver, host, or admin' }),
  }),
});

// ── Admin: Analytics ───────────────────────────────────────────────────────

/** Validates GET /api/admin/analytics/revenue query: optional period (day|week|month). */
export const revenueQuery = z.object({
  period: z.enum(['day', 'week', 'month']).optional(),
});

/** Validates GET /api/admin/analytics/top-spots query: optional limit (1–100, default 10). */
export const topSpotsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/** Validates GET /api/admin/analytics/activity query: optional limit (1–100, default 20). */
export const activityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Validates GET /api/admin/analytics/bot-usage query: optional days window. */
export const botUsageQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

// ── Admin: Ratings ─────────────────────────────────────────────────────────

/** Validates GET /api/admin/ratings query: optional spotId, hostId filters + pagination. */
export const ratingListQuery = z.object({
  spotId: z.coerce.number().int().positive().optional(),
  hostId: z.coerce.number().int().positive().optional(),
  ...pagination,
});

// ── Admin: Disputes ────────────────────────────────────────────────────────

/** Validates POST /api/admin/bookings body: create a new booking. */
export const createBookingBody = z.object({
  driverId: z.coerce.number().int().positive('Driver ID is required'),
  spotId: z.coerce.number().int().positive('Spot ID is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  status: z.string().optional(),
  totalPrice: z.coerce.number().min(0).optional(),
  paymentStatus: z.string().optional(),
  confirmationCode: z.string().optional(),
});

/** Validates PUT /api/admin/bookings/:id body: update booking fields. */
export const updateBookingBody = z.object({
  status: z.string().optional(),
  payment_status: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  total_price: z.coerce.number().min(0).optional(),
  confirmation_code: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field to update is required' });

/** Validates GET /api/admin/disputes query: optional status filter + pagination. */
export const disputeListQuery = z.object({
  status: z.string().optional(),
  ...pagination,
});

/** Validates POST /api/admin/disputes/:id/resolve body: resolution text is required. */
export const resolveDisputeBody = z.object({
  resolution: z.string().min(1, 'Resolution is required'),
});

// ── Admin: Support Tickets ─────────────────────────────────────────────────

/** Validates GET /api/admin/tickets query: optional filters + pagination. */
export const ticketListQuery = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  ...pagination,
});

/** Validates POST /api/admin/tickets/:id/status body: status and optional notes. */
export const updateTicketStatusBody = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  adminNotes: z.string().optional(),
});

/** Validates POST /api/admin/tickets/:id/assign body: adminId is required. */
export const assignTicketBody = z.object({
  adminId: z.coerce.number().int().positive(),
});

/** Validates POST /api/admin/tickets/:id/reply body: message is required. */
export const replyToTicketBody = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
});

// ── Webhook ────────────────────────────────────────────────────────────────

/** Validates POST /api/payments/chapa/webhook body: event and tx_ref are required. */
export const chapaWebhookBody = z.object({
  event: z.string(),
  tx_ref: z.string(),
  status: z.string().optional(),
  amount: z.string().optional(),
});
