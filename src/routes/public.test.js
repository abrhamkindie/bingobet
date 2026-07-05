/**
 * Integration tests for public routes — health, ready, nearby.
 *
 * @module routes/public.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestServer } from '../testSetup.js';

// ── Mock DB dependencies ───────────────────────────────────────────────────

vi.mock('../db/index.js', () => ({
  healthcheck: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../db/repositories/spots.js', () => ({
  findNearby: vi.fn(),
  findNearestAny: vi.fn(),
  listActiveMap: vi.fn(),
  searchActiveMap: vi.fn(),
}));

vi.mock('../services/chapaService.js', () => ({
  handleWebhook: vi.fn(),
}));

vi.mock('../services/paymentService.js', () => ({
  confirmChapaPayment: vi.fn(),
  sendPaymentReceipt: vi.fn(),
}));

// ── Import mocks after vi.mock ─────────────────────────────────────────────

import { healthcheck } from '../db/index.js';
import * as spotsRepo from '../db/repositories/spots.js';

/** @type {import('supertest').SuperTest<import('supertest').Test>} */
let app;

beforeEach(() => {
  vi.clearAllMocks();
  app = createTestServer().app;
});

// ── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with app name and env', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      app: 'ParkAddis',
      env: 'test',
    });
  });
});

// ── GET /ready ─────────────────────────────────────────────────────────────

describe('GET /ready', () => {
  it('returns 200 when DB is healthy', async () => {
    healthcheck.mockResolvedValue(true);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it('returns 503 when DB is down', async () => {
    healthcheck.mockResolvedValue(false);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: false });
  });

  it('returns 503 when DB throws', async () => {
    healthcheck.mockRejectedValue(new Error('Connection refused'));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: false });
  });
});

// ── GET /api/spots/nearby ─────────────────────────────────────────────────

describe('GET /api/spots/nearby', () => {
  const mockSpot = {
    id: 1,
    address: 'Bole Road',
    price_per_hour: '50',
    lat: '9.01',
    lng: '38.76',
    distance_m: 500,
    rating_avg: '4.5',
    rating_count: 10,
    covered: true,
    guarded: false,
    ev_charging: false,
  };

  it('returns nearby spots with valid coords', async () => {
    spotsRepo.findNearby.mockResolvedValue([mockSpot]);

    const res = await request(app)
      .get('/api/spots/nearby')
      .query({ lat: '9.01', lng: '38.76' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spots).toHaveLength(1);
    expect(res.body.data.spots[0].address).toBe('Bole Road');
    expect(res.body.data.fallback).toBe(false);
  });

  it('returns 422 for invalid latitude', async () => {
    const res = await request(app)
      .get('/api/spots/nearby')
      .query({ lat: '100', lng: '38.76' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for missing coords', async () => {
    const res = await request(app)
      .get('/api/spots/nearby')
      .query({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('falls back to nearest any when no nearby spots', async () => {
    spotsRepo.findNearby.mockResolvedValue([]);
    spotsRepo.findNearestAny.mockResolvedValue([mockSpot]);

    const res = await request(app)
      .get('/api/spots/nearby')
      .query({ lat: '9.01', lng: '38.76' });

    expect(res.status).toBe(200);
    expect(res.body.data.fallback).toBe(true);
    expect(res.body.data.spots).toHaveLength(1);
  });

  it('uses custom radius when provided', async () => {
    spotsRepo.findNearby.mockResolvedValue([mockSpot]);

    await request(app)
      .get('/api/spots/nearby')
      .query({ lat: '9.01', lng: '38.76', radius: '5000' });

    expect(spotsRepo.findNearby).toHaveBeenCalledWith(
      expect.objectContaining({ radiusM: 5000 }),
    );
  });
});

// ── POST /api/payments/chapa/webhook ──────────────────────────────────────

describe('POST /api/payments/chapa/webhook', () => {
  it('processes a charge.success webhook', async () => {
    const { handleWebhook } = await import('../services/chapaService.js');
    handleWebhook.mockReturnValue({
      event: 'charge.success',
      tx_ref: 'parkaddis_1_12345',
      status: 'success',
      amount: 500,
    });

    const { confirmChapaPayment } = await import('../services/paymentService.js');
    confirmChapaPayment.mockResolvedValue({
      booking: { id: 1, driver_telegram_id: null },
      payment: { id: 1, status: 'completed' },
    });

    const res = await request(app)
      .post('/api/payments/chapa/webhook')
      .send({ event: 'charge.success', tx_ref: 'parkaddis_1_12345' });

    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);
  });

  it('returns processed:false for invalid webhook payload', async () => {
    const { handleWebhook } = await import('../services/chapaService.js');
    handleWebhook.mockImplementation(() => {
      throw new Error('Missing required webhook fields');
    });

    const res = await request(app)
      .post('/api/payments/chapa/webhook')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(false);
  });

  it('handles charge.failed events gracefully', async () => {
    const { handleWebhook } = await import('../services/chapaService.js');
    handleWebhook.mockReturnValue({
      event: 'charge.failed',
      tx_ref: 'parkaddis_2_67890',
      status: 'failed',
    });

    const res = await request(app)
      .post('/api/payments/chapa/webhook')
      .send({ event: 'charge.failed', tx_ref: 'parkaddis_2_67890' });

    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);
  });
});

// ── Admin dashboard routes ────────────────────────────────────────────────

describe('Admin dashboard routes', () => {
  it('GET /admin/ returns 200 and serves admin HTML', async () => {
    const res = await request(app).get('/admin/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ParkAddis');
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /admin (no trailing slash) redirects to /admin/', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/');
  });

  it('GET /admin/index.html serves the HTML file directly', async () => {
    const res = await request(app).get('/admin/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ParkAddis');
  });

  it('admin HTML has valid CSS and JS asset references', async () => {
    const htmlRes = await request(app).get('/admin/');
    const html = htmlRes.text;

    // Verify the HTML references at least a stylesheet and a script
    expect(html).toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(html).toMatch(/<script[^>]+src=["'][^"']+["']/i);

    // Extract all CSS/JS references and verify they serve correctly
    const assetLinks = [];
    const assetRegex = /(?:href|src)="([^"]+\.(?:css|jsx?))"/gi;
    let match;
    while ((match = assetRegex.exec(html)) !== null) {
      let path = match[1];
      // Resolve relative paths to absolute ones
      if (!path.startsWith('/')) path = '/admin/' + path;
      assetLinks.push(path);
    }

    // Verify each referenced asset serves successfully
    for (const assetPath of assetLinks) {
      const assetRes = await request(app).get(assetPath);
      expect(assetRes.status).toBe(200);
    }

    expect(assetLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /admin/ nonexistent path returns 200 (SPA fallback to index.html)', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ParkAddis');
  });

  it('GET /admin/spots serves index.html (client-side route)', async () => {
    const res = await request(app).get('/admin/spots');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ParkAddis');
  });
});

// ── 404 for unknown routes ─────────────────────────────────────────────────

describe('unknown routes', () => {
  it('returns 404 for unmatched path', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
