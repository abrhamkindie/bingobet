import express from 'express';
import crypto from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger, setCorrelationId, clearCorrelationId } from './utils/logger.js';
import { startScheduler, stopScheduler as stopNotificationScheduler } from './services/scheduler.js';
import { errorHandler, notFoundHandler, setupProcessErrorHandlers } from './middlewares/errorHandler.js';

import { createPublicRouter } from './routes/public.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createMiniAppRouter } from './routes/miniapp.routes.js';

export function createServer(bot) {

  const app = express();

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://telegram.org'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://t.me'],
      },
    },
  }));

  const corsOrigins = config.security?.corsOrigins || '*';
  app.use(cors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(o => o.trim()),
    credentials: true,
  }));

  if (config.env !== 'development') {
    app.use(rateLimit({
      windowMs: config.security?.rateLimitWindowMs || 15 * 60 * 1000,
      max: config.security?.rateLimitMaxRequests || 100,
      message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }

  // Raw body for Chapa webhook
  app.use('/api/payments/chapa/webhook', (req, res, next) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      if (data) {
        try { req.body = JSON.parse(data); } catch { req.body = {}; }
        req._body = true;
      }
      next();
    });
  });

  app.use(express.json({ limit: '15mb' }));

  // Correlation ID
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    setCorrelationId(requestId);
    res.setHeader('x-request-id', requestId);
    res.on('finish', clearCorrelationId);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/ready') return next();
    const start = Date.now();
    logger.info(`${req.method} ${req.path}`);
    res.on('finish', () => {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  // Scheduler
  startScheduler(bot);
  logger.info('BetBingo scheduler started');

  // Process error handlers
  setupProcessErrorHandlers();

  // Mount routes
  app.use(createPublicRouter(bot));
  app.use('/api/miniapp', createMiniAppRouter());
  app.use('/api/admin', createAuthRouter());

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    stopScheduler: stopNotificationScheduler,
  };
}
