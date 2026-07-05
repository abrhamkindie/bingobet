import { Router } from 'express';
import * as playersRepo from '../../db/repositories/players.js';
import { authenticate, authorizeRole } from '../../middlewares/auth.js';
import { success } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/errors.js';

export function createAdminPlayersRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const { limit, offset } = req.query;
      const result = await playersRepo.listAll({ limit: Number(limit) || 20, offset: Number(offset) || 0 });
      success(res, result);
    } catch (err) { next(err); }
  });

  router.post('/:id/ban', authorizeRole('admin', 'superadmin'), async (req, res, next) => {
    try {
      const player = await playersRepo.ban(Number(req.params.id), req.body.reason || null);
      if (!player) throw new AppError('PLAYER_NOT_FOUND', 404);
      success(res, { player });
    } catch (err) { next(err); }
  });

  router.post('/:id/unban', authorizeRole('admin', 'superadmin'), async (req, res, next) => {
    try {
      const player = await playersRepo.unban(Number(req.params.id));
      if (!player) throw new AppError('PLAYER_NOT_FOUND', 404);
      success(res, { player });
    } catch (err) { next(err); }
  });

  return router;
}
