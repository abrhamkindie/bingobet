import { Router } from 'express';
import * as adminRepo from '../db/repositories/admin.js';
import { login, hashPassword } from '../services/authService.js';
import { success, created } from '../utils/apiResponse.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { validate } from '../middlewares/validate.js';
import { AppError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import * as schemas from '../utils/schemas.js';

import { createAdminGamesRouter } from './admin/games.routes.js';
import { createAdminPlayersRouter } from './admin/players.routes.js';
import { createAdminTransactionsRouter } from './admin/transactions.routes.js';
import { createAdminDashboardRouter } from './admin/dashboard.routes.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/login',
    validate({ body: schemas.login }),
    asyncHandler(async (req, res) => {
      const { email, password } = req.body;
      try {
        const result = await login({ email, password });
        success(res, result);
      } catch (err) {
        if (err.message === 'INVALID_CREDENTIALS') {
          throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
        }
        throw err;
      }
    }));

  router.post('/register',
    validate({ body: schemas.register }),
    asyncHandler(async (req, res) => {
      if (config.env === 'production') {
        throw new AppError('FORBIDDEN', 403, 'Registration disabled in production');
      }
      const { email, password, name, role } = req.body;
      const existing = await adminRepo.getByEmail(email);
      if (existing) throw new ConflictError('Admin already exists');
      const passwordHash = await hashPassword(password);
      const admin = await adminRepo.createAdmin({
        email,
        passwordHash,
        name: name || email,
        role: role || 'admin',
      });
      logger.info('Admin registered', { adminId: admin.id, email: admin.email });
      created(res, { id: admin.id, email: admin.email, name: admin.name, role: admin.role });
    }));

  // Admin resource routes
  router.use('/games', createAdminGamesRouter());
  router.use('/players', createAdminPlayersRouter());
  router.use('/transactions', createAdminTransactionsRouter());
  router.use('/dashboard', createAdminDashboardRouter());

  return router;
}
