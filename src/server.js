/**
 * ParkAddis Express Server — Route composition.
 *
 * All route logic lives in domain-specific modules under `src/routes/`.
 * This file only applies global middleware, mounts routers, and starts
 * background services (notification scheduler).
 *
 * @module server
 */

import express from 'express';
import crypto from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger, setCorrelationId, clearCorrelationId } from './utils/logger.js';
import { startScheduler, stopScheduler as stopNotificationScheduler } from './services/scheduler.js';
import { errorHandler, notFoundHandler, setupProcessErrorHandlers } from './middlewares/errorHandler.js';
import { setBot } from './botRef.js';

// Route modules
import { createPublicRouter } from './routes/public.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAdminSpotsRouter } from './routes/admin/spots.routes.js';
import { createAdminBookingsRouter } from './routes/admin/bookings.routes.js';
import { createAdminPaymentsRouter } from './routes/admin/payments.routes.js';
import { createAdminFinanceRouter } from './routes/admin/finance.routes.js';
import { createAdminDisputesRouter } from './routes/admin/disputes.routes.js';
import { createAdminUsersRouter } from './routes/admin/users.routes.js';
import { createAdminAnalyticsRouter } from './routes/admin/analytics.routes.js';
import { createAdminRatingsRouter } from './routes/admin/ratings.routes.js';
import { createAdminTicketsRouter } from './routes/admin/tickets.routes.js';
import { createMiniAppRouter } from './routes/miniapp.routes.js';

/**
 * Creates and configures the Express application.
 *
 * @param {import('grammy').Bot} [bot] - The Telegram bot instance (optional; needed for
 *   scheduler and webhook handlers that reply to users)
 * @returns {{ app: import('express').Express, stopScheduler: () => void }}
 *   The configured Express app and a function to gracefully stop the notification scheduler.
 */
export function createServer(bot) {
  // Store bot globally for admin routes
  if (bot) setBot(bot);

  const app = express();

  // ── Security Middleware ─────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://telegram.org', 'https://unpkg.com', 'https://tile.openstreetmap.org'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://router.project-osrm.org', 'https://*.openstreetmap.org'],
        frameSrc: ["'self'", 'https://t.me'],
      },
    },
  }));

  // CORS
  const corsOrigins = config.security?.corsOrigins || '*';
  app.use(cors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(o => o.trim()),
    credentials: true,
  }));

  // Rate limiting (disabled in development)
  if (config.env !== 'development') {
    app.use(rateLimit({
      windowMs: config.security?.rateLimitWindowMs || 15 * 60 * 1000,
      max: config.security?.rateLimitMaxRequests || 100,
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
      standardHeaders: true,
      legacyHeaders: false,
    }));

    app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
    }));
  }

  // Capture raw body for the Chapa webhook route — needed for HMAC signature
  // verification. Runs before express.json() so we get the raw bytes.
  // Sets req._body = true to prevent body-parser from re-parsing the
  // already-consumed stream and overwriting req.body with {}.
  app.use('/api/payments/chapa/webhook', (req, res, next) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      if (data) {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        req._body = true; // tell body-parser to skip
      }
      next();
    });
  });

  app.use(express.json({ limit: '15mb' }));

  // ── Correlation ID ──────────────────────────────────────────────
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    setCorrelationId(requestId);
    res.setHeader('x-request-id', requestId);
    res.on('finish', clearCorrelationId);
    next();
  });

  // ── Request Logging ─────────────────────────────────────────────
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/ready') return next();
    const start = Date.now();
    logger.info(`${req.method} ${req.path}`, {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      body: (req.method === 'POST' || req.method === 'PUT')
        ? JSON.stringify(req.body).slice(0, 200)
        : undefined,
    });
    res.on('finish', () => {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // ── Scheduler ───────────────────────────────────────────────────
  if (config.notifications?.enabled !== false) {
    startScheduler(bot);
    logger.info('Notification scheduler started');
  } else {
    logger.info('Notification scheduler disabled');
  }

  // ── Process error handlers ──────────────────────────────────────
  setupProcessErrorHandlers();

  // ── Mount Routes ────────────────────────────────────────────────

  // Public routes (health, ready, nearby, miniapp, chapa webhook)
  app.use(createPublicRouter(bot));

  // Mini App API (Telegram WebApp)
  app.use('/api/miniapp', createMiniAppRouter());

  // Admin auth (login, register)
  app.use('/api/admin', createAuthRouter());

  // Admin resources (each scoped under /api/admin/<resource>)
  app.use('/api/admin/spots', createAdminSpotsRouter());
  app.use('/api/admin/bookings', createAdminBookingsRouter());
  app.use('/api/admin/payments', createAdminPaymentsRouter());
  app.use('/api/admin/finance', createAdminFinanceRouter());
  app.use('/api/admin/disputes', createAdminDisputesRouter());
  app.use('/api/admin/users', createAdminUsersRouter());
  app.use('/api/admin/analytics', createAdminAnalyticsRouter());
  app.use('/api/admin/ratings', createAdminRatingsRouter());
  app.use('/api/admin/tickets', createAdminTicketsRouter());

  // ── Error Handling (must be last) ───────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    stopScheduler: stopNotificationScheduler,
  };
}
