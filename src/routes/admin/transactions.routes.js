import { Router } from 'express';
import * as transactionsRepo from '../../db/repositories/transactions.js';
import { authenticate } from '../../middlewares/auth.js';
import { success } from '../../utils/apiResponse.js';

export function createAdminTransactionsRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const { type, status, limit, offset } = req.query;
      const result = await transactionsRepo.listAll({
        type: type || null,
        status: status || null,
        limit: Number(limit) || 20,
        offset: Number(offset) || 0,
      });
      success(res, result);
    } catch (err) { next(err); }
  });

  return router;
}
