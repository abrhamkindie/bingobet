import { query } from '../../index.js';
import * as botEventsRepo from '../botEvents.js';

// Get platform-wide statistics.
export async function getPlatformStats() {
  const { rows } = await query(
    `SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM spots WHERE status = 'active') AS active_spots,
      (SELECT COUNT(*) FROM spots WHERE status = 'pending_approval') AS pending_spots,
      (SELECT COUNT(*) FROM bookings) AS total_bookings,
      (SELECT COUNT(*) FROM bookings WHERE status IN ('reserved', 'confirmed', 'active')) AS active_bookings,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid') AS total_revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE status = 'pending') AS pending_payouts,
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
      (SELECT COUNT(*) FROM disputes WHERE status = 'open') AS open_disputes`
  );
  return rows[0];
}

// Get revenue statistics grouped by period (day/week/month).
export async function getRevenueStats({ period = 'day' } = {}) {
  let dateFormat;
  switch (period) {
    case 'month':
      dateFormat = 'YYYY-MM';
      break;
    case 'week':
      dateFormat = 'IYYY-IW';
      break;
    default:
      dateFormat = 'YYYY-MM-DD';
  }

  const { rows } = await query(
    `SELECT 
      TO_CHAR(p.created_at, $1) AS period,
      COUNT(*) AS payment_count,
      COALESCE(SUM(p.amount), 0) AS total_amount,
      COALESCE(SUM(p.commission_amount), 0) AS commission
    FROM payments p
    WHERE p.status = 'paid'
    GROUP BY period
    ORDER BY period DESC
    LIMIT 30`,
    [dateFormat]
  );
  return rows;
}

// Get booking statistics by status.
export async function getBookingStats() {
  const { rows } = await query(
    `SELECT status, COUNT(*) AS count
     FROM bookings
     GROUP BY status
     ORDER BY count DESC`
  );
  return rows;
}

// Get payment method breakdown.
export async function getPaymentMethodStats() {
  const { rows } = await query(
    `SELECT method, status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
     FROM payments
     GROUP BY method, status
     ORDER BY count DESC`
  );
  return rows;
}

// Get top spots by booking count.
export async function getTopSpots(limit = 10) {
  const { rows } = await query(
    `SELECT s.id, s.address, s.price_per_hour, s.rating_avg, s.rating_count,
            COUNT(b.id) AS booking_count,
            COALESCE(SUM(p.amount), 0) AS total_revenue
     FROM spots s
     LEFT JOIN bookings b ON b.spot_id = s.id
     LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'paid'
     WHERE s.status = 'active'
     GROUP BY s.id
     ORDER BY booking_count DESC, total_revenue DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// Get recent activity feed (latest bookings, payments, disputes).
export async function getRecentActivity(limit = 20) {
  const { rows } = await query(
    `SELECT 'booking' AS type, b.id, b.created_at, b.status::text AS status,
            b.confirmation_code AS reference, s.address AS details
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     UNION ALL
     SELECT 'payment' AS type, p.id, p.created_at, p.status::text AS status,
            p.reference, b.confirmation_code AS details
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     UNION ALL
     SELECT 'dispute' AS type, d.id, d.created_at, d.status::text AS status,
            d.reason, b.confirmation_code AS details
     FROM disputes d
     JOIN bookings b ON b.id = d.booking_id
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getBotUsageAnalytics({ days = 30 } = {}) {
  const [summary, trend, breakdown, funnel] = await Promise.all([
    botEventsRepo.getBotUsageSummary({ days }),
    botEventsRepo.getBotUsageTrend({ days: Math.min(days, 30) }),
    botEventsRepo.getBotEventBreakdown({ days }),
    botEventsRepo.getBotFunnel({ days }),
  ]);
  return { days, summary, trend, breakdown, funnel };
}

const REPORT_INTERVAL_FORMATS = {
  hour: 'YYYY-MM-DD HH24:00',
  day: 'YYYY-MM-DD',
  week: 'IYYY-IW',
  month: 'YYYY-MM',
  year: 'YYYY',
};

/**
 * Get a filtered miniapp admin report.
 *
 * @param {object} options
 * @param {'payments'|'bookings'|'marketplace'|'support'|'users'|'finance'} options.type
 * @param {string} options.startDate - Inclusive ISO timestamp
 * @param {string} options.endDate - Exclusive ISO timestamp
 * @param {'hour'|'day'|'week'|'month'|'year'} options.interval
 * @param {number} options.limit
 */
export async function getMiniappReport({
  type = 'payments',
  startDate,
  endDate,
  interval = 'day',
  limit = 8,
} = {}) {
  const safeInterval = REPORT_INTERVAL_FORMATS[interval] ? interval : 'day';
  const base = {
    type,
    range: { start_date: startDate, end_date: endDate, interval: safeInterval },
  };

  if (type === 'bookings') {
    return { ...base, ...(await getBookingReport({ startDate, endDate, interval: safeInterval, limit })) };
  }
  if (type === 'marketplace') {
    return { ...base, ...(await getMarketplaceReport({ startDate, endDate, interval: safeInterval, limit })) };
  }
  if (type === 'support') {
    return { ...base, ...(await getSupportReport({ startDate, endDate, interval: safeInterval, limit })) };
  }
  if (type === 'users') {
    return { ...base, ...(await getUsersReport({ startDate, endDate, interval: safeInterval, limit })) };
  }
  if (type === 'finance') {
    return { ...base, ...(await getFinanceReport({ startDate, endDate, interval: safeInterval, limit })) };
  }
  return { ...base, ...(await getPaymentReport({ startDate, endDate, interval: safeInterval, limit })) };
}

async function getPaymentReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, status, method, rows] = await Promise.all([
    query(
      `SELECT
        COUNT(*) AS total_payments,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_payments,
        COUNT(*) FILTER (WHERE status = 'awaiting_review') AS review_payments,
        COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_payments,
        COALESCE(SUM(amount), 0) AS gross_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_amount,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) AS commission_amount,
        COALESCE(SUM(host_payout_amount) FILTER (WHERE status = 'paid'), 0) AS host_payout_amount
       FROM payments
       WHERE created_at >= $1 AND created_at < $2`,
      [startDate, endDate]
    ),
    reportTrend(
      `payments`,
      `created_at`,
      `COUNT(*) AS count,
       COALESCE(SUM(amount), 0) AS amount,
       COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_amount`,
      { startDate, endDate, interval }
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
       FROM payments
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT method::text AS label, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
       FROM payments
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY method
       ORDER BY amount DESC, count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT p.id, p.booking_id, p.method::text AS method, p.amount, p.commission_amount,
              p.host_payout_amount, p.status::text AS status, p.reference, p.created_at,
              b.confirmation_code, s.address, d.name AS driver_name
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN spots s ON s.id = b.spot_id
       JOIN users d ON d.id = b.driver_id
       WHERE p.created_at >= $1 AND p.created_at < $2
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      status: status.rows.map(numberize),
      method: method.rows.map(numberize),
    },
    rows: rows.rows.map(numberize),
  };
}

async function getBookingReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, status, paymentStatus, rows] = await Promise.all([
    query(
      `SELECT
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (WHERE status IN ('reserved', 'confirmed', 'active')) AS active_bookings,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_bookings,
        COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_bookings,
        COALESCE(SUM(total_price), 0) AS booking_value,
        COALESCE(SUM(total_price) FILTER (WHERE payment_status = 'paid'), 0) AS paid_value
       FROM bookings
       WHERE created_at >= $1 AND created_at < $2`,
      [startDate, endDate]
    ),
    reportTrend(
      `bookings`,
      `created_at`,
      `COUNT(*) AS count,
       COALESCE(SUM(total_price), 0) AS amount,
       COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_count`,
      { startDate, endDate, interval }
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS amount
       FROM bookings
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT payment_status::text AS label, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS amount
       FROM bookings
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY payment_status
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT b.id, b.confirmation_code, b.status::text AS status, b.payment_status::text AS payment_status,
              b.total_price, b.start_time, b.end_time, b.created_at,
              s.address, d.name AS driver_name
       FROM bookings b
       JOIN spots s ON s.id = b.spot_id
       JOIN users d ON d.id = b.driver_id
       WHERE b.created_at >= $1 AND b.created_at < $2
       ORDER BY b.created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      status: status.rows.map(numberize),
      payment_status: paymentStatus.rows.map(numberize),
    },
    rows: rows.rows.map(numberize),
  };
}

async function getMarketplaceReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, status, topSpots, rows] = await Promise.all([
    query(
      `SELECT
        (SELECT COUNT(*) FROM spots WHERE status = 'active') AS active_spots,
        (SELECT COUNT(*) FROM spots WHERE status = 'pending_approval') AS pending_spots,
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS new_spots,
        COUNT(*) FILTER (WHERE approved_at >= $1 AND approved_at < $2) AS approved_spots,
        COUNT(*) FILTER (WHERE rejected_at >= $1 AND rejected_at < $2) AS rejected_spots
       FROM spots`,
      [startDate, endDate]
    ),
    reportTrend(
      `spots`,
      `created_at`,
      `COUNT(*) AS count, 0::numeric AS amount`,
      { startDate, endDate, interval }
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count
       FROM spots
       GROUP BY status
       ORDER BY count DESC`
    ),
    query(
      `SELECT s.id, s.address, s.price_per_hour, s.rating_avg, s.rating_count,
              COUNT(b.id) AS booking_count,
              COALESCE(SUM(p.amount), 0) AS total_revenue
       FROM spots s
       LEFT JOIN bookings b ON b.spot_id = s.id
       LEFT JOIN payments p ON p.booking_id = b.id
        AND p.status = 'paid'
        AND p.created_at >= $1 AND p.created_at < $2
       GROUP BY s.id
       ORDER BY total_revenue DESC, booking_count DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
    query(
      `SELECT s.id, s.address, s.status::text AS status, s.price_per_hour,
              s.capacity, s.created_at, u.name AS owner_name
       FROM spots s
       JOIN users u ON u.id = s.owner_id
       WHERE s.created_at >= $1 AND s.created_at < $2
       ORDER BY s.created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      status: status.rows.map(numberize),
    },
    top_spots: topSpots.rows.map(numberize),
    rows: rows.rows.map(numberize),
  };
}

async function getSupportReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, ticketStatus, category, disputeStatus, rows] = await Promise.all([
    query(
      `SELECT
        (SELECT COUNT(*) FROM support_tickets WHERE created_at >= $1 AND created_at < $2) AS tickets_created,
        (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND COALESCE(resolved_at, updated_at) >= $1 AND COALESCE(resolved_at, updated_at) < $2) AS tickets_resolved,
        (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
        (SELECT COUNT(*) FROM disputes WHERE created_at >= $1 AND created_at < $2) AS disputes_created,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('resolved', 'rejected') AND updated_at >= $1 AND updated_at < $2) AS disputes_closed,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open') AS open_disputes`,
      [startDate, endDate]
    ),
    query(
      `SELECT
        DATE_TRUNC($3, created_at) AS period_start,
        TO_CHAR(DATE_TRUNC($3, created_at), $4) AS label,
        COUNT(*) FILTER (WHERE source = 'ticket') AS tickets,
        COUNT(*) FILTER (WHERE source = 'dispute') AS disputes,
        COUNT(*) AS count,
        0::numeric AS amount
       FROM (
        SELECT created_at, 'ticket' AS source FROM support_tickets WHERE created_at >= $1 AND created_at < $2
        UNION ALL
        SELECT created_at, 'dispute' AS source FROM disputes WHERE created_at >= $1 AND created_at < $2
       ) report_events
       GROUP BY period_start, label
       ORDER BY period_start ASC`,
      [startDate, endDate, interval, REPORT_INTERVAL_FORMATS[interval]]
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count
       FROM support_tickets
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT category::text AS label, COUNT(*) AS count
       FROM support_tickets
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY category
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count
       FROM disputes
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status
       ORDER BY count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT *
       FROM (
        SELECT 'ticket' AS kind, id, category::text AS label, status::text AS status,
               description AS title, created_at
        FROM support_tickets
        WHERE created_at >= $1 AND created_at < $2
        UNION ALL
        SELECT 'dispute' AS kind, d.id, d.status::text AS label, d.status::text AS status,
               d.reason AS title, d.created_at
        FROM disputes d
        WHERE d.created_at >= $1 AND d.created_at < $2
       ) rows
       ORDER BY created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      ticket_status: ticketStatus.rows.map(numberize),
      category: category.rows.map(numberize),
      dispute_status: disputeStatus.rows.map(numberize),
    },
    rows: rows.rows.map(numberize),
  };
}

async function getUsersReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, role, rows] = await Promise.all([
    query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS new_users,
        (SELECT COUNT(*) FROM users WHERE role = 'driver') AS total_drivers,
        (SELECT COUNT(*) FROM users WHERE role = 'host') AS total_hosts,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') AS total_admins,
        (SELECT COUNT(*) FROM users WHERE is_banned = true) AS banned_users
       FROM users`,
      [startDate, endDate]
    ),
    reportTrend(
      `users`,
      `created_at`,
      `COUNT(*) AS count, 0::numeric AS amount`,
      { startDate, endDate, interval }
    ),
    query(
      `SELECT role::text AS label, COUNT(*) AS count
       FROM users
       GROUP BY role
       ORDER BY count DESC`
    ),
    query(
      `SELECT id, telegram_id, name, username, role::text AS role, is_banned, created_at
       FROM users
       WHERE created_at >= $1 AND created_at < $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      role: role.rows.map(numberize),
    },
    rows: rows.rows.map(numberize),
  };
}

async function getFinanceReport({ startDate, endDate, interval, limit }) {
  const [summary, trend, status, rows] = await Promise.all([
    query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) AS payouts_created,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= $1 AND created_at < $2), 0) AS payout_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'sent' AND sent_at >= $1 AND sent_at < $2), 0) AS sent_amount,
        COALESCE((SELECT SUM(balance) FROM host_balances WHERE balance > 0), 0) AS current_balance_due,
        COALESCE((SELECT SUM(host_payout_amount) FROM payments WHERE status = 'paid' AND created_at >= $1 AND created_at < $2), 0) AS earned_host_payout
       FROM payouts`,
      [startDate, endDate]
    ),
    reportTrend(
      `payouts`,
      `created_at`,
      `COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount`,
      { startDate, endDate, interval }
    ),
    query(
      `SELECT status::text AS label, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
       FROM payouts
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status
       ORDER BY amount DESC, count DESC`,
      [startDate, endDate]
    ),
    query(
      `SELECT p.id, p.host_id, p.amount, p.status::text AS status, p.note, p.sent_at, p.created_at,
              u.name AS host_name, u.telegram_id AS owner_telegram_id
       FROM payouts p
       JOIN users u ON u.id = p.host_id
       WHERE p.created_at >= $1 AND p.created_at < $2
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [startDate, endDate, limit]
    ),
  ]);

  return {
    summary: numberize(summary.rows[0]),
    trend: trend.rows.map(numberize),
    breakdowns: {
      status: status.rows.map(numberize),
    },
    rows: rows.rows.map(numberize),
  };
}

function reportTrend(table, dateColumn, selectClause, { startDate, endDate, interval }) {
  const format = REPORT_INTERVAL_FORMATS[interval] || REPORT_INTERVAL_FORMATS.day;
  return query(
    `SELECT
      DATE_TRUNC($3, ${dateColumn}) AS period_start,
      TO_CHAR(DATE_TRUNC($3, ${dateColumn}), $4) AS label,
      ${selectClause}
     FROM ${table}
     WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2
     GROUP BY period_start, label
     ORDER BY period_start ASC`,
    [startDate, endDate, interval, format]
  );
}

function numberize(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value === null || value === undefined) return [key, value];
      if (value instanceof Date) return [key, value];
      if (typeof value === 'number' || typeof value === 'boolean') return [key, value];
      if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value)) {
        return [key, Number(value)];
      }
      return [key, value];
    })
  );
}
