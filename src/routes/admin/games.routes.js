import { Router } from 'express';
import * as gameRoundsRepo from '../../db/repositories/gameRounds.js';
import * as ticketsRepo from '../../db/repositories/tickets.js';
import { createGame, startDraw } from '../../services/gameService.js';
import { authenticate, authorizeRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { createGameBody, idParam } from '../../utils/schemas.js';
import { success } from '../../utils/apiResponse.js';
import { AppError } from '../../utils/errors.js';

export function createAdminGamesRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const { status, limit, offset } = req.query;
      const result = await gameRoundsRepo.listAll({ status, limit: Number(limit) || 20, offset: Number(offset) || 0 });
      success(res, result);
    } catch (err) { next(err); }
  });

  router.get('/:id', validate({ params: idParam }), async (req, res, next) => {
    try {
      const game = await gameRoundsRepo.getById(Number(req.params.id));
      if (!game) throw new AppError('GAME_NOT_FOUND', 404);
      success(res, { game });
    } catch (err) { next(err); }
  });

  router.post('/', authorizeRole('admin', 'superadmin'), validate({ body: createGameBody }), async (req, res, next) => {
    try {
      const game = await createGame({ ...req.body, createdBy: req.admin.id });
      res.status(201).json({ success: true, data: { game } });
    } catch (err) { next(err); }
  });

  router.post('/:id/draw', authorizeRole('admin', 'superadmin'), async (req, res, next) => {
    try {
      const result = await startDraw(Number(req.params.id));
      success(res, { result });
    } catch (err) { next(err); }
  });

  router.get('/:id/tickets', async (req, res, next) => {
    try {
      const tickets = await ticketsRepo.listByGame(Number(req.params.id));
      success(res, { tickets });
    } catch (err) { next(err); }
  });

  return router;
}
