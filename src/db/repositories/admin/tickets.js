/**
 * @file Repository for admin support ticket operations.
 *
 * @module db/repositories/admin/tickets
 */

import { query } from '../../index.js';

/**
 * List all support tickets with pagination and optional filters.
 *
 * @param {Object}        [options]
 * @param {string}        [options.status]   Filter by status (open, in_progress, resolved, closed)
 * @param {string}        [options.category] Filter by category (payment, booking, host, feature, other)
 * @param {string}        [options.search]   Search in description or user name
 * @param {number}        [options.limit=20]
 * @param {number}        [options.offset=0]
 * @returns {Promise<{tickets: Object[], total: number}>}
 */
export async function listAll({ status, category, search, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (category) {
    conditions.push(`t.category = $${idx++}`);
    params.push(category);
  }
  if (search) {
    conditions.push(`(t.description ILIKE $${idx} OR u.name ILIKE $${idx} OR u.telegram_id::text ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows: tickets } = await query(
    `SELECT t.*,
            u.name AS user_name,
            u.telegram_id AS user_telegram_id,
            u.language_pref AS user_language_pref,
            a.name AS assigned_admin_name,
            (SELECT COUNT(*) FROM ticket_replies tr WHERE tr.ticket_id = t.id) AS reply_count
     FROM support_tickets t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN admin_users a ON a.id = t.assigned_to
     ${whereClause}
     ORDER BY
       CASE WHEN t.status IN ('open', 'in_progress') THEN 0 ELSE 1 END,
       t.updated_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const { rows: count } = await query(
    `SELECT COUNT(*) FROM support_tickets t JOIN users u ON u.id = t.user_id ${whereClause}`,
    params
  );

  return {
    tickets,
    total: parseInt(count[0].count, 10),
  };
}

/**
 * Get a single support ticket with user info and replies.
 *
 * @param {number} id - Ticket ID
 * @returns {Promise<Object|null>}
 */
export async function getById(id) {
  const { rows: tickets } = await query(
    `SELECT t.*,
            u.name AS user_name,
            u.telegram_id AS user_telegram_id,
            u.language_pref AS user_language_pref,
            a.name AS assigned_admin_name
     FROM support_tickets t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN admin_users a ON a.id = t.assigned_to
     WHERE t.id = $1`,
    [id]
  );

  if (!tickets.length) return null;

  const ticket = tickets[0];

  // Fetch replies
  const { rows: replies } = await query(
    `SELECT tr.*,
            a.name AS admin_name
     FROM ticket_replies tr
     LEFT JOIN admin_users a ON a.id = tr.admin_id
     WHERE tr.ticket_id = $1
     ORDER BY tr.created_at ASC`,
    [id]
  );

  ticket.replies = replies;
  return ticket;
}

/**
 * Update ticket status.
 *
 * @param {number}  id
 * @param {string}  status  - New status (open, in_progress, resolved, closed)
 * @param {Object}  [options]
 * @param {number}  [options.assignedTo] - Admin user id to assign
 * @param {string}  [options.adminNotes] - Admin notes
 * @returns {Promise<Object|null>}
 */
export async function updateStatus(id, status, { assignedTo, adminNotes } = {}) {
  const sets = ['status = $2'];
  const params = [id, status];
  let idx = 3;

  if (assignedTo !== undefined) {
    sets.push(`assigned_to = $${idx++}`);
    params.push(assignedTo);
  }
  if (adminNotes !== undefined) {
    sets.push(`admin_notes = $${idx++}`);
    params.push(adminNotes);
  }
  if (status === 'resolved' || status === 'closed') {
    sets.push('resolved_at = now()');
  }

  const { rows } = await query(
    `UPDATE support_tickets SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}

/**
 * Assign a ticket to an admin.
 *
 * @param {number} ticketId
 * @param {number} adminId - Admin user id
 * @returns {Promise<Object|null>}
 */
export async function assign(ticketId, adminId) {
  const { rows } = await query(
    `UPDATE support_tickets SET assigned_to = $2, status = 'in_progress', updated_at = now()
     WHERE id = $1 RETURNING *`,
    [ticketId, adminId]
  );
  return rows[0] || null;
}

/**
 * Add a reply to a ticket.
 *
 * @param {Object}  params
 * @param {number}  params.ticketId
 * @param {number}  [params.adminId]  - Admin who replied (null if user replied)
 * @param {number}  [params.userId]   - User who replied (null if admin replied)
 * @param {string}  params.message    - Reply text
 * @param {boolean} [params.isFromAdmin=true]
 * @returns {Promise<Object>}
 */
export async function addReply({ ticketId, adminId, userId, message, isFromAdmin = true }) {
  const { rows } = await query(
    `INSERT INTO ticket_replies (ticket_id, admin_id, user_id, message, is_from_admin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [ticketId, adminId || null, userId || null, message, isFromAdmin]
  );
  return rows[0];
}

/**
 * Get open ticket count for dashboard badges.
 *
 * @returns {Promise<number>}
 */
export async function getOpenCount() {
  const { rows } = await query(
    "SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open', 'in_progress')"
  );
  return parseInt(rows[0].count, 10);
}
