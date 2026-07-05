/**
 * Admin support ticket management routes.
 *
 * All routes require authentication.
 * Mounted at `/api/admin/tickets`.
 *
 * @module routes/admin/tickets
 */
import { Router } from 'express';
import * as adminTicketsRepo from '../../db/repositories/admin/tickets.js';
import { authenticate } from '../../middlewares/auth.js';
import { success, paginated, created } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../middlewares/errorHandler.js';
import { validate } from '../../middlewares/validate.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import * as schemas from '../../utils/schemas.js';
import { getBot } from '../../botRef.js';
import { sendTicketReplyNotification } from '../../services/notificationService.js';

/**
 * Creates the admin support tickets router.
 * @returns {import('express').Router}
 */
export function createAdminTicketsRouter() {
  const router = Router();

  router.use(authenticate);

  // List tickets (?status=open&category=payment&search=&limit=20&offset=0)
  router.get('/',
    validate({ query: schemas.ticketListQuery }),
    asyncHandler(async (req, res) => {
      const { status, category, search, limit, offset } = req.query;
      const result = await adminTicketsRepo.listAll({ status, category, search, limit, offset });
      paginated(res, result.tickets, { total: result.total, limit, offset });
    }));

  // Ticket details with replies
  router.get('/:id',
    validate({ params: schemas.idParam }),
    asyncHandler(async (req, res) => {
      const ticket = await adminTicketsRepo.getById(req.params.id);
      if (!ticket) throw new NotFoundError('Ticket not found');
      success(res, ticket);
    }));

  // Assign ticket to an admin
  router.post('/:id/assign',
    validate({ params: schemas.idParam, body: schemas.assignTicketBody }),
    asyncHandler(async (req, res) => {
      const { adminId } = req.body;
      const ticket = await adminTicketsRepo.assign(req.params.id, adminId);
      if (!ticket) throw new NotFoundError('Ticket not found');
      logger.info('Ticket assigned', { ticketId: ticket.id, adminId });
      success(res, ticket);
    }));

  // Update ticket status
  router.post('/:id/status',
    validate({ params: schemas.idParam, body: schemas.updateTicketStatusBody }),
    asyncHandler(async (req, res) => {
      const { status, adminNotes } = req.body;
      const ticket = await adminTicketsRepo.updateStatus(req.params.id, status, { adminNotes });
      if (!ticket) throw new NotFoundError('Ticket not found');
      logger.info('Ticket status updated', { ticketId: ticket.id, status, adminId: req.admin.id });
      success(res, ticket);
    }));

  // Reply to ticket — also notifies the user on Telegram
  router.post('/:id/reply',
    validate({ params: schemas.idParam, body: schemas.replyToTicketBody }),
    asyncHandler(async (req, res) => {
      const { message } = req.body;
      const ticket = await adminTicketsRepo.getById(req.params.id);
      if (!ticket) throw new NotFoundError('Ticket not found');

      const reply = await adminTicketsRepo.addReply({
        ticketId: req.params.id,
        adminId: req.admin.id,
        message,
        isFromAdmin: true,
      });

      logger.info('Ticket reply added', { ticketId: ticket.id, adminId: req.admin.id });

      // Notify the user on Telegram (best-effort — never fails the reply)
      if (ticket.user_telegram_id) {
        const bot = getBot();
        sendTicketReplyNotification(bot, ticket, reply);
      }

      success(res, { reply, ticket: { ...ticket, replies: [...(ticket.replies || []), reply] } });
    }));

  return router;
}
