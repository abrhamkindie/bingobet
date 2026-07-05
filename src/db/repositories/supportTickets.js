/**
 * @file Repository for support_tickets table operations.
 *
 * @module db/repositories/supportTickets
 */

import { query } from '../index.js';

/**
 * Create a new support ticket.
 *
 * @param {Object} params
 * @param {number} params.userId - The user's internal DB id
 * @param {string} params.category - Ticket category (payment, booking, host, feature, other)
 * @param {string} params.description - The user's issue description
 * @param {string|null} [params.screenshotFileId] - Optional Telegram file_id of a screenshot
 * @returns {Promise<Object>} The created ticket row
 */
export async function create({ userId, category, description, screenshotFileId, autoCategory }) {
  const { rows } = await query(
    `INSERT INTO support_tickets (user_id, category, description, screenshot_file_id, auto_category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, category, description, screenshotFileId || null, autoCategory || null]
  );
  return rows[0];
}

/**
 * Get a ticket by its id.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getById(id) {
  const { rows } = await query('SELECT * FROM support_tickets WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * List tickets for a given user, most recent first.
 *
 * @param {number} userId - Internal user id
 * @param {number} [limit=10]
 * @returns {Promise<Object[]>}
 */
export async function listByUser(userId, limit = 10) {
  const { rows } = await query(
    `SELECT st.*,
            (SELECT COUNT(*) FROM ticket_replies tr WHERE tr.ticket_id = st.id) AS reply_count
     FROM support_tickets st
     WHERE st.user_id = $1
     ORDER BY st.updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/**
 * List all open tickets (for admin use).
 *
 * @param {number} [limit=50]
 * @returns {Promise<Object[]>}
 */
export async function listOpen(limit = 50) {
  const { rows } = await query(
    "SELECT st.*, u.name AS user_name, u.telegram_id FROM support_tickets st JOIN users u ON u.id = st.user_id WHERE st.status IN ('open', 'in_progress') ORDER BY st.created_at ASC LIMIT $1",
    [limit]
  );
  return rows;
}

/**
 * Update ticket status.
 *
 * @param {number} id
 * @param {string} status - New status (open, in_progress, resolved, closed)
 * @param {Object} [extra]
 * @param {number} [extra.assignedTo] - Admin user id
 * @param {string} [extra.adminNotes] - Admin notes
 * @returns {Promise<Object|null>}
 */
export async function updateStatus(id, status, { assignedTo, adminNotes } = {}) {
  const sets = ["status = $2"];
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
    `UPDATE support_tickets SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return rows[0] || null;
}
