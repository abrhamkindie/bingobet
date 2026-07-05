import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ role: 'driver' }));

vi.mock('../middlewares/telegramAuth.js', () => ({
  telegramAuth: () => (req, _res, next) => {
    req.tgUser = { id: 900000001, first_name: 'Dev' };
    req.dbUser = { id: 1, telegram_id: 900000001, name: 'Dev User', role: authState.role, language_pref: 'en' };
    next();
  },
}));

vi.mock('../db/repositories/spots.js', () => ({
  findNearby: vi.fn(),
  findNearestAny: vi.fn(),
  listActiveMap: vi.fn(),
  searchActiveMap: vi.fn(),
  getById: vi.fn(),
  getAvailability: vi.fn(),
}));

vi.mock('../db/repositories/bookings.js', () => ({
  listByDriver: vi.fn(),
  getById: vi.fn(),
  updateStatus: vi.fn(),
  listBySpot: vi.fn(),
}));

vi.mock('../db/repositories/vehicles.js', () => ({
  listByUser: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setDefault: vi.fn(),
}));

vi.mock('../db/repositories/favorites.js', () => ({
  getUserFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('../db/repositories/users.js', () => ({
  setLanguage: vi.fn(),
  setRole: vi.fn(),
}));

vi.mock('../db/repositories/ratings.js', () => ({
  listBySpot: vi.fn(),
}));

vi.mock('../db/repositories/payments.js', () => ({
  getByBookingId: vi.fn(),
}));

vi.mock('../db/repositories/supportTickets.js', () => ({
  listByUser: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../db/repositories/host.js', () => ({
  getHostCapabilities: vi.fn(() => ({
    owns_spots: false,
    manages_spots: false,
    has_host_access: false,
    can_view_reports: false,
  })),
  listAccessibleSpots: vi.fn(),
  getSpotAccess: vi.fn(),
  getHostRevenueReport: vi.fn(),
  listHostBookingHistory: vi.fn(),
  listManagers: vi.fn(),
  assignManager: vi.fn(),
  updateManager: vi.fn(),
  removeManager: vi.fn(),
}));

vi.mock('../db/repositories/admin/bookings.js', () => ({
  listAll: vi.fn(),
  cancel: vi.fn(),
  listPayments: vi.fn(),
  getPaymentById: vi.fn(),
  refundPayment: vi.fn(),
}));

vi.mock('../db/repositories/admin/analytics.js', () => ({
  getMiniappReport: vi.fn(),
  getPlatformStats: vi.fn(),
  getBookingStats: vi.fn(),
  getPaymentMethodStats: vi.fn(),
  getRecentActivity: vi.fn(),
  getTopSpots: vi.fn(),
}));

vi.mock('../services/bookingService.js', () => ({
  reserve: vi.fn(),
  BookingError: class BookingError extends Error {},
}));

vi.mock('../services/paymentService.js', () => ({
  checkChapaPayment: vi.fn(),
  initiatePayment: vi.fn(),
}));

vi.mock('../services/ratingService.js', () => ({
  submitRating: vi.fn(),
  canRateBooking: vi.fn(),
  getUnratedBookings: vi.fn(),
  RatingError: class RatingError extends Error {},
}));

vi.mock('../services/checkinService.js', () => ({
  checkIn: vi.fn(),
  checkInByConfirmationCode: vi.fn(),
  checkInByBookingId: vi.fn(),
  complete: vi.fn(),
  CheckinError: class CheckinError extends Error {},
}));

vi.mock('../botRef.js', () => ({
  getBot: vi.fn(() => null),
}));

vi.mock('../utils/qr.js', () => ({
  checkinQrPng: vi.fn(),
}));

vi.mock('../utils/deeplink.js', () => ({
  checkinLink: vi.fn(() => 'https://example.test/checkin'),
}));

import { createMiniAppRouter } from './miniapp.routes.js';
import * as spotsRepo from '../db/repositories/spots.js';
import * as supportTicketsRepo from '../db/repositories/supportTickets.js';
import * as checkinService from '../services/checkinService.js';
import * as adminBookingsRepo from '../db/repositories/admin/bookings.js';
import * as adminAnalyticsRepo from '../db/repositories/admin/analytics.js';
import * as hostRepo from '../db/repositories/host.js';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/miniapp', createMiniAppRouter());
  return server;
}

const spot = {
  id: 7,
  address: 'Bole Atlas parking',
  price_per_hour: '45',
  lat: '8.998',
  lng: '38.789',
  distance_m: 450,
  rating_avg: '4.25',
  rating_count: 8,
  capacity: 3,
  occupied_spaces: 1,
  available_spaces: 2,
  is_full_now: false,
  covered: true,
  guarded: true,
  ev_charging: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = 'driver';
  hostRepo.getHostCapabilities.mockResolvedValue({
    owns_spots: false,
    manages_spots: false,
    has_host_access: false,
    can_view_reports: false,
  });
});

describe('Mini App spot map routes', () => {
  it('returns only 2 km nearby spots when requested by the map', async () => {
    spotsRepo.findNearby.mockResolvedValue([spot]);

    const res = await request(app())
      .get('/api/miniapp/spots/nearby')
      .query({ lat: '9.01', lng: '38.76', radius: '2000' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.radius_m).toBe(2000);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.spots).toHaveLength(1);
    expect(spotsRepo.findNearby).toHaveBeenCalledWith(expect.objectContaining({
      lat: 9.01,
      lng: 38.76,
      radiusM: 2000,
    }));
    expect(spotsRepo.findNearestAny).not.toHaveBeenCalled();
  });

  it('does not fall back to far-away spots unless fallback=true', async () => {
    spotsRepo.findNearby.mockResolvedValue([]);

    const res = await request(app())
      .get('/api/miniapp/spots/nearby')
      .query({ lat: '9.01', lng: '38.76', radius: '2000' });

    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(false);
    expect(res.body.data.spots).toEqual([]);
    expect(spotsRepo.findNearestAny).not.toHaveBeenCalled();
  });

  it('lists all active host spots for map browsing', async () => {
    spotsRepo.listActiveMap.mockResolvedValue([spot]);

    const res = await request(app())
      .get('/api/miniapp/spots/map')
      .query({ lat: '9.01', lng: '38.76' });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('all');
    expect(res.body.data.spots[0]).toMatchObject({ id: 7, available_spaces: 2 });
    expect(spotsRepo.listActiveMap).toHaveBeenCalledWith(expect.objectContaining({
      lat: 9.01,
      lng: 38.76,
    }));
  });

  it('lists all active host spots even when no map center is provided', async () => {
    spotsRepo.listActiveMap.mockResolvedValue([spot]);

    const res = await request(app())
      .get('/api/miniapp/spots/map');

    expect(res.status).toBe(200);
    expect(res.body.data.spots).toHaveLength(1);
    expect(spotsRepo.listActiveMap).toHaveBeenCalledWith(expect.objectContaining({
      lat: null,
      lng: null,
    }));
  });

  it('searches all active host spots by text', async () => {
    spotsRepo.searchActiveMap.mockResolvedValue([spot]);

    const res = await request(app())
      .get('/api/miniapp/spots/search')
      .query({ q: 'bole', lat: '9.01', lng: '38.76' });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('search');
    expect(res.body.data.q).toBe('bole');
    expect(res.body.data.spots).toHaveLength(1);
    expect(spotsRepo.searchActiveMap).toHaveBeenCalledWith(expect.objectContaining({
      q: 'bole',
      lat: 9.01,
      lng: 38.76,
    }));
  });
});

describe('Mini App host check-in routes', () => {
  const checkedInBooking = {
    id: 21,
    spot_id: 7,
    driver_id: 5,
    confirmation_code: 'PK-7F3K9',
    start_time: '2026-07-01T08:00:00.000Z',
    end_time: '2026-07-01T10:00:00.000Z',
    status: 'active',
    total_price: '90',
    payment_status: 'paid',
    address: 'Bole Atlas parking',
    checkin_token: 'qr_token',
    driver_name: 'Samrawit',
  };

  it('checks in a driver by QR token from the host panel', async () => {
    checkinService.checkIn.mockResolvedValue({ booking: checkedInBooking });

    const res = await request(app())
      .post('/api/miniapp/host/checkin')
      .send({ token: 'qr_token' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({
      id: 21,
      confirmation_code: 'PK-7F3K9',
      status: 'active',
    });
    expect(res.body.data.driver_name).toBe('Samrawit');
    expect(checkinService.checkIn).toHaveBeenCalledWith(expect.objectContaining({
      scannerTelegramId: 900000001,
      scannerRole: 'driver',
      token: 'qr_token',
    }));
  });

  it('checks in a driver by typed confirmation code from the host panel', async () => {
    checkinService.checkInByConfirmationCode.mockResolvedValue({ booking: checkedInBooking });

    const res = await request(app())
      .post('/api/miniapp/host/checkin')
      .send({ confirmationCode: 'pk-7f3k9' });

    expect(res.status).toBe(200);
    expect(checkinService.checkInByConfirmationCode).toHaveBeenCalledWith(expect.objectContaining({
      scannerTelegramId: 900000001,
      scannerRole: 'driver',
      confirmationCode: 'PK-7F3K9',
    }));
  });
});

describe('Mini App host delegation routes', () => {
  it('lists spots assigned to a manager even when their global role is driver', async () => {
    hostRepo.listAccessibleSpots.mockResolvedValue([{
      ...spot,
      status: 'active',
      is_available: true,
      photos: [],
      owner_id: 9,
      host_access_role: 'manager',
      is_owner: false,
      can_manage_spots: true,
      can_manage_bookings: true,
      can_view_reports: false,
    }]);

    const res = await request(app()).get('/api/miniapp/host/spots');

    expect(res.status).toBe(200);
    expect(res.body.data.spots[0]).toMatchObject({
      id: 7,
      host_access_role: 'manager',
      is_owner: false,
      can_manage_spots: true,
      can_manage_bookings: true,
    });
    expect(hostRepo.listAccessibleSpots).toHaveBeenCalledWith(1);
  });

  it('allows only parking owners to assign host managers', async () => {
    hostRepo.getHostCapabilities.mockResolvedValue({
      owns_spots: false,
      manages_spots: true,
      has_host_access: true,
      can_view_reports: false,
    });

    const res = await request(app())
      .post('/api/miniapp/host/managers')
      .send({ managerIdentifier: '@ops' });

    expect(res.status).toBe(403);
    expect(hostRepo.assignManager).not.toHaveBeenCalled();
  });

  it('assigns a manager by username when the current user owns spots', async () => {
    hostRepo.getHostCapabilities.mockResolvedValue({
      owns_spots: true,
      manages_spots: false,
      has_host_access: true,
      can_view_reports: true,
    });
    hostRepo.assignManager.mockResolvedValue({
      id: 4,
      owner_id: 1,
      manager_id: 12,
      manager_name: 'Operations User',
      manager_username: 'ops',
      manager_telegram_id: 900000002,
      spot_id: null,
      spot_address: null,
      can_manage_bookings: true,
      can_manage_spots: true,
      can_view_reports: false,
      is_active: true,
    });

    const res = await request(app())
      .post('/api/miniapp/host/managers')
      .send({ managerIdentifier: '@ops', canViewReports: false });

    expect(res.status).toBe(201);
    expect(res.body.data.manager).toMatchObject({
      id: 4,
      manager_telegram_id: 900000002,
      can_manage_bookings: true,
      can_manage_spots: true,
    });
    expect(hostRepo.assignManager).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 1,
      managerIdentifier: '@ops',
    }));
  });

  it('accepts manager username aliases from the host panel payload', async () => {
    hostRepo.getHostCapabilities.mockResolvedValue({
      owns_spots: true,
      manages_spots: false,
      has_host_access: true,
      can_view_reports: true,
    });
    hostRepo.assignManager.mockResolvedValue({
      id: 5,
      owner_id: 1,
      manager_id: 13,
      manager_name: 'Ops Alias',
      manager_username: 'ops_alias',
      manager_telegram_id: 900000003,
      spot_id: null,
      spot_address: null,
      can_manage_bookings: true,
      can_manage_spots: true,
      can_view_reports: false,
      is_active: true,
    });

    const res = await request(app())
      .post('/api/miniapp/host/managers')
      .send({ manager_username: '@ops_alias' });

    expect(res.status).toBe(201);
    expect(hostRepo.assignManager).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 1,
      managerIdentifier: '@ops_alias',
    }));
  });
});

describe('Mini App support ticket routes', () => {
  const ticket = {
    id: 44,
    user_id: 1,
    category: 'payment',
    auto_category: 'payment',
    description: 'Payment was deducted but the booking still shows unpaid.',
    status: 'open',
    reply_count: '1',
    created_at: '2026-07-01T08:00:00.000Z',
    updated_at: '2026-07-01T08:20:00.000Z',
    resolved_at: null,
  };

  it('lists the authenticated user support tickets', async () => {
    supportTicketsRepo.listByUser.mockResolvedValue([ticket]);

    const res = await request(app())
      .get('/api/miniapp/support/tickets')
      .query({ limit: '5' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.tickets[0]).toMatchObject({
      id: 44,
      category: 'payment',
      status: 'open',
      reply_count: 1,
    });
    expect(supportTicketsRepo.listByUser).toHaveBeenCalledWith(1, 5);
  });

  it('creates a support ticket for the authenticated user', async () => {
    supportTicketsRepo.create.mockResolvedValue({ ...ticket, reply_count: undefined });

    const res = await request(app())
      .post('/api/miniapp/support/tickets')
      .send({
        category: 'payment',
        description: ticket.description,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ticket).toMatchObject({
      id: 44,
      category: 'payment',
      auto_category: 'payment',
      reply_count: 0,
    });
    expect(supportTicketsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      category: 'payment',
      description: ticket.description,
      screenshotFileId: null,
      autoCategory: 'payment',
    }));
  });
});

describe('Mini App admin payment routes', () => {
  const payment = {
    id: 31,
    booking_id: 12,
    method: 'chapa',
    amount: '500',
    commission_amount: '50',
    host_payout_amount: '450',
    status: 'paid',
    reference: 'tx-123',
    confirmation_code: 'PK-123',
    address: 'Bole Atlas parking',
    driver_name: 'Dev Driver',
    driver_telegram_id: 111,
    owner_name: 'Host Owner',
    owner_telegram_id: 222,
    booking_status: 'confirmed',
    booking_payment_status: 'paid',
    booking_total_price: '500',
    spot_id: 7,
    owner_id: 9,
    start_time: '2026-07-01T08:00:00.000Z',
    end_time: '2026-07-01T10:00:00.000Z',
    created_at: '2026-07-01T07:55:00.000Z',
    updated_at: '2026-07-01T07:56:00.000Z',
  };

  it('returns payment details for mini app admins', async () => {
    authState.role = 'admin';
    adminBookingsRepo.getPaymentById.mockResolvedValue(payment);

    const res = await request(app()).get('/api/miniapp/admin/payments/31');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment).toMatchObject({
      id: 31,
      booking_id: 12,
      method: 'chapa',
      amount: 500,
      commission_amount: 50,
      host_payout_amount: 450,
      booking_status: 'confirmed',
      booking_payment_status: 'paid',
      spot_id: 7,
      owner_name: 'Host Owner',
      driver_name: 'Dev Driver',
    });
    expect(adminBookingsRepo.getPaymentById).toHaveBeenCalledWith(31);
  });

  it('blocks non-admin users from payment details', async () => {
    const res = await request(app()).get('/api/miniapp/admin/payments/31');

    expect(res.status).toBe(403);
    expect(adminBookingsRepo.getPaymentById).not.toHaveBeenCalled();
  });

  it('returns 404 for missing payment details', async () => {
    authState.role = 'admin';
    adminBookingsRepo.getPaymentById.mockResolvedValue(null);

    const res = await request(app()).get('/api/miniapp/admin/payments/999');

    expect(res.status).toBe(404);
  });
});

describe('Mini App admin report routes', () => {
  it('returns filtered report data with local date-only labels', async () => {
    authState.role = 'admin';
    adminAnalyticsRepo.getMiniappReport.mockResolvedValue({
      type: 'payments',
      range: { interval: 'day' },
      summary: {
        total_payments: '3',
        paid_amount: '1200',
      },
      trend: [{
        label: '2026-07-04',
        period_start: new Date('2026-07-04T09:00:00.000Z'),
        count: '3',
        amount: '1200',
      }],
      breakdowns: {
        status: [{ label: 'paid', count: '3', amount: '1200' }],
      },
      rows: [{
        id: '31',
        amount: '500',
        status: 'paid',
        created_at: new Date('2026-07-04T10:00:00.000Z'),
      }],
    });

    const res = await request(app())
      .get('/api/miniapp/admin/reports')
      .query({
        type: 'payments',
        startDate: '2026-07-04',
        endDate: '2026-07-04',
        interval: 'day',
        limit: '10',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.report.range).toMatchObject({
      start_date: '2026-07-04',
      end_date: '2026-07-04',
      interval: 'day',
    });
    expect(res.body.data.report.summary).toMatchObject({
      total_payments: 3,
      paid_amount: 1200,
    });
    expect(res.body.data.report.trend[0]).toMatchObject({
      count: 3,
      amount: 1200,
      period_start: '2026-07-04T09:00:00.000Z',
    });

    const params = adminAnalyticsRepo.getMiniappReport.mock.calls[0][0];
    expect(params).toMatchObject({
      type: 'payments',
      interval: 'day',
      limit: 10,
    });

    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 6, 4, 0]);
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 6, 5, 0]);
  });

  it('rejects report ranges where the end date is before the start date', async () => {
    authState.role = 'admin';

    const res = await request(app())
      .get('/api/miniapp/admin/reports')
      .query({
        startDate: '2026-07-05',
        endDate: '2026-07-04',
      });

    expect(res.status).toBe(400);
    expect(adminAnalyticsRepo.getMiniappReport).not.toHaveBeenCalled();
  });

  it('accepts the legacy misspelled reportes route', async () => {
    authState.role = 'admin';
    adminAnalyticsRepo.getMiniappReport.mockResolvedValue({
      type: 'payments',
      range: { interval: 'day' },
      summary: {},
      trend: [],
      breakdowns: {},
      rows: [],
    });

    const res = await request(app()).get('/api/miniapp/admin/reportes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(adminAnalyticsRepo.getMiniappReport).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payments',
      interval: 'day',
    }));
  });
});
