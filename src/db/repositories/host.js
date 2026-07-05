import { query } from '../index.js';

const ACTIVE_MANAGER_FILTER = `
  hm.owner_id = s.owner_id
  AND hm.manager_id = $1
  AND hm.is_active = true
  AND (hm.spot_id IS NULL OR hm.spot_id = s.id)
`;

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeManagerIdentifier({ managerIdentifier = null, managerUsername = null, managerTelegramId = null } = {}) {
  const raw = String(managerIdentifier || managerUsername || managerTelegramId || '').trim();
  if (!raw) return { telegramId: null, username: null };

  const withoutUrl = raw
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .split(/[/?#]/)[0]
    .trim();
  const cleaned = withoutUrl.replace(/^@/, '').trim();

  if (/^\d+$/.test(cleaned)) {
    return { telegramId: cleaned, username: null };
  }

  return {
    telegramId: null,
    username: cleaned || null,
  };
}

function paidReportCte(permission = 'can_view_reports') {
  const safePermission = ['can_view_reports', 'can_manage_bookings'].includes(permission)
    ? permission
    : 'can_view_reports';

  return `
    WITH accessible_spots AS (
      SELECT s.id
      FROM spots s
      LEFT JOIN LATERAL (
        SELECT
          bool_or(hm.can_manage_bookings) AS can_manage_bookings,
          bool_or(hm.can_view_reports) AS can_view_reports,
          COUNT(*) > 0 AS has_access
        FROM host_managers hm
        WHERE ${ACTIVE_MANAGER_FILTER}
      ) hm ON true
      WHERE s.owner_id = $1 OR COALESCE(hm.${safePermission}, false)
    )
  `;
}

function addDateAndSpotFilters({ startDate, endDate, spotId } = {}, params, timeColumn = 'p.updated_at') {
  const where = [];

  if (startDate) {
    params.push(startDate);
    where.push(`${timeColumn} >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`${timeColumn} < $${params.length}`);
  }
  if (spotId) {
    params.push(spotId);
    where.push(`s.id = $${params.length}`);
  }

  return where.length ? `AND ${where.join(' AND ')}` : '';
}

function mapMoneySummary(row = {}) {
  return {
    gross_revenue: Number(row.gross_revenue || 0),
    host_earnings: Number(row.host_earnings || 0),
    commission: Number(row.commission || 0),
    paid_bookings: Number(row.paid_bookings || 0),
  };
}

// Get lightweight host capability flags for the current user.
export async function getHostCapabilities(userId) {
  const { rows } = await query(
    `SELECT
       EXISTS (SELECT 1 FROM spots WHERE owner_id = $1) AS owns_spots,
       EXISTS (
         SELECT 1 FROM host_managers
         WHERE manager_id = $1 AND is_active = true
       ) AS manages_spots,
       EXISTS (
         SELECT 1 FROM host_managers
         WHERE manager_id = $1 AND is_active = true AND can_view_reports = true
       ) AS can_view_reports`,
    [userId]
  );

  const row = rows[0] || {};
  return {
    owns_spots: !!row.owns_spots,
    manages_spots: !!row.manages_spots,
    has_host_access: !!row.owns_spots || !!row.manages_spots,
    can_view_reports: !!row.owns_spots || !!row.can_view_reports,
  };
}

// Spots the user owns or has been assigned to manage.
export async function listAccessibleSpots(userId) {
  const { rows } = await query(
    `SELECT s.*,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now,
            CASE WHEN s.owner_id = $1 THEN 'owner' ELSE 'manager' END AS host_access_role,
            s.owner_id = $1 AS is_owner,
            (s.owner_id = $1 OR COALESCE(hm.can_manage_spots, false)) AS can_manage_spots,
            (s.owner_id = $1 OR COALESCE(hm.can_manage_bookings, false)) AS can_manage_bookings,
            (s.owner_id = $1 OR COALESCE(hm.can_view_reports, false)) AS can_view_reports
     FROM spots s
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS occupied_spaces
       FROM bookings b
       WHERE b.spot_id = s.id
         AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
         AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
     ) o ON true
     LEFT JOIN LATERAL (
       SELECT
         bool_or(hm.can_manage_bookings) AS can_manage_bookings,
         bool_or(hm.can_manage_spots) AS can_manage_spots,
         bool_or(hm.can_view_reports) AS can_view_reports,
         COUNT(*) > 0 AS has_access
       FROM host_managers hm
       WHERE ${ACTIVE_MANAGER_FILTER}
     ) hm ON true
     WHERE s.owner_id = $1 OR COALESCE(hm.has_access, false)
     ORDER BY is_owner DESC, s.created_at DESC`,
    [userId]
  );
  return rows;
}

// Load a spot only when the user owns it or has delegated access.
export async function getSpotAccess(spotId, userId) {
  const { rows } = await query(
    `SELECT s.*,
            ST_Y(s.geom::geometry) AS lat,
            ST_X(s.geom::geometry) AS lng,
            COALESCE(o.occupied_spaces, 0)::integer AS occupied_spaces,
            GREATEST(s.capacity - COALESCE(o.occupied_spaces, 0), 0)::integer AS available_spaces,
            s.capacity <= COALESCE(o.occupied_spaces, 0) AS is_full_now,
            CASE WHEN s.owner_id = $2 THEN 'owner' ELSE 'manager' END AS host_access_role,
            s.owner_id = $2 AS is_owner,
            (s.owner_id = $2 OR COALESCE(hm.can_manage_spots, false)) AS can_manage_spots,
            (s.owner_id = $2 OR COALESCE(hm.can_manage_bookings, false)) AS can_manage_bookings,
            (s.owner_id = $2 OR COALESCE(hm.can_view_reports, false)) AS can_view_reports
     FROM spots s
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS occupied_spaces
       FROM bookings b
       WHERE b.spot_id = s.id
         AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
         AND tstzrange(b.start_time, b.end_time) && tstzrange(now(), now() + interval '1 hour')
     ) o ON true
     LEFT JOIN LATERAL (
       SELECT
         bool_or(hm.can_manage_bookings) AS can_manage_bookings,
         bool_or(hm.can_manage_spots) AS can_manage_spots,
         bool_or(hm.can_view_reports) AS can_view_reports,
         COUNT(*) > 0 AS has_access
       FROM host_managers hm
       WHERE hm.owner_id = s.owner_id
         AND hm.manager_id = $2
         AND hm.is_active = true
         AND (hm.spot_id IS NULL OR hm.spot_id = s.id)
     ) hm ON true
     WHERE s.id = $1
       AND (s.owner_id = $2 OR COALESCE(hm.has_access, false))`,
    [spotId, userId]
  );
  return rows[0] || null;
}

// Check whether a Telegram user can manage a booking's arrival/completion.
export async function canManageBookingByTelegram({ bookingId, telegramId }) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM bookings b
       JOIN spots s ON s.id = b.spot_id
       JOIN users u ON u.telegram_id = $2 AND u.is_banned = false
       LEFT JOIN LATERAL (
         SELECT bool_or(hm.can_manage_bookings) AS can_manage_bookings
         FROM host_managers hm
         WHERE hm.owner_id = s.owner_id
           AND hm.manager_id = u.id
           AND hm.is_active = true
           AND (hm.spot_id IS NULL OR hm.spot_id = s.id)
       ) hm ON true
       WHERE b.id = $1
         AND (u.role = 'admin' OR s.owner_id = u.id OR COALESCE(hm.can_manage_bookings, false))
     ) AS allowed`,
    [bookingId, telegramId]
  );
  return !!rows[0]?.allowed;
}

// Owner + assigned managers who should receive booking operational messages.
export async function listBookingNotificationRecipients(bookingId) {
  const { rows } = await query(
    `WITH target AS (
       SELECT b.id AS booking_id, s.id AS spot_id, s.owner_id
       FROM bookings b
       JOIN spots s ON s.id = b.spot_id
       WHERE b.id = $1
     ),
     recipients AS (
       SELECT u.id, u.telegram_id, u.name, u.language_pref, true AS is_owner, 'owner' AS access_role
       FROM target t
       JOIN users u ON u.id = t.owner_id
       WHERE u.is_banned = false

       UNION ALL

       SELECT u.id, u.telegram_id, u.name, u.language_pref, false AS is_owner, 'manager' AS access_role
       FROM target t
       JOIN host_managers hm ON hm.owner_id = t.owner_id
        AND hm.is_active = true
        AND hm.can_manage_bookings = true
        AND (hm.spot_id IS NULL OR hm.spot_id = t.spot_id)
       JOIN users u ON u.id = hm.manager_id
       WHERE u.is_banned = false
     )
     SELECT DISTINCT ON (id) id, telegram_id, name, language_pref, is_owner, access_role
     FROM recipients
     WHERE telegram_id IS NOT NULL
     ORDER BY id, is_owner DESC`,
    [bookingId]
  );
  return rows;
}

// Get host earnings summary for the bot /earnings command.
export async function getHostEarnings(hostId) {
  const { rows: totalRows } = await query(
    `SELECT COALESCE(SUM(p.host_payout_amount), 0) AS total_earnings,
            COUNT(DISTINCT b.id) AS total_bookings
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     WHERE s.owner_id = $1
       AND p.status = 'paid'`,
    [hostId]
  );

  const { rows: monthRows } = await query(
    `SELECT COALESCE(SUM(p.host_payout_amount), 0) AS monthly_earnings,
            COUNT(DISTINCT b.id) AS monthly_bookings
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     WHERE s.owner_id = $1
       AND p.status = 'paid'
       AND p.updated_at >= date_trunc('month', now())`,
    [hostId]
  );

  const { rows: payoutRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS pending_payouts
     FROM payouts
     WHERE host_id = $1 AND status = 'pending'`,
    [hostId]
  );

  const totalEarnings = Number(totalRows[0].total_earnings || 0);
  const pendingPayouts = Number(payoutRows[0].pending_payouts || 0);

  return {
    total_earnings: totalEarnings,
    total_bookings: Number(totalRows[0].total_bookings || 0),
    monthly_earnings: Number(monthRows[0].monthly_earnings || 0),
    monthly_bookings: Number(monthRows[0].monthly_bookings || 0),
    pending_payouts: pendingPayouts,
    available_balance: totalEarnings - pendingPayouts,
  };
}

// Get host's recent paid bookings for earnings breakdown.
export async function getHostRecentBookings(hostId, limit = 10) {
  const { rows } = await query(
    `SELECT b.id, b.total_price, b.start_time, b.end_time, b.status, b.payment_status,
            p.amount, p.host_payout_amount, p.commission_amount,
            s.address, d.name AS driver_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     WHERE s.owner_id = $1
       AND p.status = 'paid'
     ORDER BY p.updated_at DESC
     LIMIT $2`,
    [hostId, limit]
  );
  return rows;
}

// Get host's spots with paid earning breakdown.
export async function getHostSpotsEarnings(hostId) {
  const { rows } = await query(
    `SELECT s.id, s.address, s.price_per_hour,
            COUNT(DISTINCT b.id) AS total_bookings,
            COALESCE(SUM(p.host_payout_amount), 0) AS total_earnings
     FROM spots s
     LEFT JOIN bookings b ON b.spot_id = s.id
     LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'paid'
     WHERE s.owner_id = $1
     GROUP BY s.id
     ORDER BY total_earnings DESC`,
    [hostId]
  );
  return rows;
}

// Revenue dashboard with today/week/month cards and selected-range report.
export async function getHostRevenueReport(userId, {
  startDate = null,
  endDate = null,
  spotId = null,
  interval = 'day',
} = {}) {
  const groupInterval = ['day', 'week', 'month'].includes(interval) ? interval : 'day';
  const params = [userId];
  const selectedFilter = addDateAndSpotFilters({ startDate, endDate, spotId }, params);
  const cte = paidReportCte('can_view_reports');

  const { rows: summaryRows } = await query(
    `${cte}
     SELECT COALESCE(SUM(p.amount), 0) AS gross_revenue,
            COALESCE(SUM(p.host_payout_amount), 0) AS host_earnings,
            COALESCE(SUM(p.commission_amount), 0) AS commission,
            COUNT(DISTINCT b.id) AS paid_bookings
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE p.status = 'paid'
       ${selectedFilter}`,
    params
  );

  const presetParams = [userId];
  const spotFilter = addDateAndSpotFilters({ spotId }, presetParams);
  const { rows: presetRows } = await query(
    `${cte}
     SELECT
       COALESCE(SUM(p.host_payout_amount) FILTER (WHERE p.updated_at >= date_trunc('day', now())), 0) AS today_earnings,
       COUNT(DISTINCT b.id) FILTER (WHERE p.updated_at >= date_trunc('day', now())) AS today_bookings,
       COALESCE(SUM(p.host_payout_amount) FILTER (WHERE p.updated_at >= date_trunc('week', now())), 0) AS week_earnings,
       COUNT(DISTINCT b.id) FILTER (WHERE p.updated_at >= date_trunc('week', now())) AS week_bookings,
       COALESCE(SUM(p.host_payout_amount) FILTER (WHERE p.updated_at >= date_trunc('month', now())), 0) AS month_earnings,
       COUNT(DISTINCT b.id) FILTER (WHERE p.updated_at >= date_trunc('month', now())) AS month_bookings
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE p.status = 'paid'
       ${spotFilter}`,
    presetParams
  );

  const bySpotParams = [userId];
  const bySpotFilter = addDateAndSpotFilters({ startDate, endDate, spotId }, bySpotParams);
  const { rows: bySpotRows } = await query(
    `${cte}
     SELECT s.id, s.address,
            COUNT(DISTINCT b.id) AS paid_bookings,
            COALESCE(SUM(p.amount), 0) AS gross_revenue,
            COALESCE(SUM(p.host_payout_amount), 0) AS host_earnings
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE p.status = 'paid'
       ${bySpotFilter}
     GROUP BY s.id, s.address
     ORDER BY host_earnings DESC, paid_bookings DESC`,
    bySpotParams
  );

  const timelineParams = [userId];
  const timelineFilter = addDateAndSpotFilters({ startDate, endDate, spotId }, timelineParams);
  const { rows: timelineRows } = await query(
    `${cte}
     SELECT date_trunc('${groupInterval}', p.updated_at) AS bucket,
            COUNT(DISTINCT b.id) AS paid_bookings,
            COALESCE(SUM(p.host_payout_amount), 0) AS host_earnings,
            COALESCE(SUM(p.amount), 0) AS gross_revenue
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE p.status = 'paid'
       ${timelineFilter}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    timelineParams
  );

  const recentParams = [userId];
  const recentFilter = addDateAndSpotFilters({ startDate, endDate, spotId }, recentParams);
  const { rows: recentRows } = await query(
    `${cte}
     SELECT b.id, b.confirmation_code, b.start_time, b.end_time, b.status, b.payment_status,
            p.amount, p.host_payout_amount, p.commission_amount, p.updated_at AS paid_at,
            s.id AS spot_id, s.address, d.name AS driver_name
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE p.status = 'paid'
       ${recentFilter}
     ORDER BY p.updated_at DESC
     LIMIT 8`,
    recentParams
  );

  const presets = presetRows[0] || {};
  return {
    summary: mapMoneySummary(summaryRows[0]),
    presets: {
      today: {
        earnings: Number(presets.today_earnings || 0),
        bookings: Number(presets.today_bookings || 0),
      },
      week: {
        earnings: Number(presets.week_earnings || 0),
        bookings: Number(presets.week_bookings || 0),
      },
      month: {
        earnings: Number(presets.month_earnings || 0),
        bookings: Number(presets.month_bookings || 0),
      },
    },
    by_spot: bySpotRows.map((row) => ({
      id: Number(row.id),
      address: row.address,
      paid_bookings: Number(row.paid_bookings || 0),
      gross_revenue: Number(row.gross_revenue || 0),
      host_earnings: Number(row.host_earnings || 0),
    })),
    timeline: timelineRows.map((row) => ({
      bucket: row.bucket,
      paid_bookings: Number(row.paid_bookings || 0),
      gross_revenue: Number(row.gross_revenue || 0),
      host_earnings: Number(row.host_earnings || 0),
    })),
    recent_bookings: recentRows.map((row) => ({
      ...row,
      amount: Number(row.amount || 0),
      host_payout_amount: Number(row.host_payout_amount || 0),
      commission_amount: Number(row.commission_amount || 0),
    })),
  };
}

// Booking history for owner/manager operations.
export async function listHostBookingHistory(userId, {
  spotId = null,
  status = null,
  startDate = null,
  endDate = null,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit = Math.min(toInt(limit, 20), 50);
  const safeOffset = toInt(offset, 0);
  const params = [userId];
  const where = [];

  if (spotId) {
    params.push(spotId);
    where.push(`s.id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`b.status = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    where.push(`b.start_time >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    where.push(`b.start_time < $${params.length}`);
  }

  const filterSql = where.length ? `AND ${where.join(' AND ')}` : '';
  const cte = paidReportCte('can_manage_bookings');

  const { rows: bookingRows } = await query(
    `${cte}
     SELECT b.id, b.spot_id, b.driver_id, b.confirmation_code, b.start_time, b.end_time,
            b.status, b.total_price, b.payment_status, b.created_at,
            s.address, d.name AS driver_name,
            p.id AS payment_id, p.method AS payment_method, p.status AS payment_record_status,
            p.amount AS payment_amount, p.host_payout_amount, p.commission_amount
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     JOIN users d ON d.id = b.driver_id
     JOIN accessible_spots a ON a.id = s.id
     LEFT JOIN LATERAL (
       SELECT id, method, status, amount, host_payout_amount, commission_amount
       FROM payments
       WHERE booking_id = b.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) p ON true
     WHERE true
       ${filterSql}
     ORDER BY b.start_time DESC, b.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, safeOffset]
  );

  const { rows: countRows } = await query(
    `${cte}
     SELECT COUNT(*) AS total
     FROM bookings b
     JOIN spots s ON s.id = b.spot_id
     JOIN accessible_spots a ON a.id = s.id
     WHERE true
       ${filterSql}`,
    params
  );

  return {
    bookings: bookingRows,
    total: Number(countRows[0]?.total || 0),
    limit: safeLimit,
    offset: safeOffset,
  };
}

export async function listManagers(ownerId) {
  const { rows } = await query(
    `SELECT hm.*,
            u.name AS manager_name,
            u.username AS manager_username,
            u.telegram_id AS manager_telegram_id,
            s.address AS spot_address
     FROM host_managers hm
     JOIN users u ON u.id = hm.manager_id
     LEFT JOIN spots s ON s.id = hm.spot_id
     WHERE hm.owner_id = $1
     ORDER BY hm.is_active DESC, hm.updated_at DESC, hm.created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function assignManager({
  ownerId,
  managerIdentifier = null,
  managerUsername = null,
  managerTelegramId = null,
  spotId = null,
  canManageBookings = true,
  canManageSpots = true,
  canViewReports = false,
}) {
  const identifier = normalizeManagerIdentifier({ managerIdentifier, managerUsername, managerTelegramId });
  if (!identifier.telegramId && !identifier.username) throw new Error('MANAGER_IDENTIFIER_REQUIRED');

  const { rows: managerRows } = await query(
    `SELECT id, telegram_id, name, username
     FROM users
     WHERE is_banned = false
       AND (
         ($1::bigint IS NOT NULL AND telegram_id = $1::bigint)
         OR ($2::text IS NOT NULL AND lower(username) = lower($2::text))
       )
     ORDER BY id ASC
     LIMIT 1`,
    [identifier.telegramId, identifier.username]
  );
  const manager = managerRows[0];
  if (!manager) throw new Error('MANAGER_NOT_FOUND');
  if (String(manager.id) === String(ownerId)) throw new Error('MANAGER_IS_OWNER');

  if (spotId) {
    const { rowCount } = await query(
      `SELECT 1 FROM spots WHERE id = $1 AND owner_id = $2`,
      [spotId, ownerId]
    );
    if (rowCount === 0) throw new Error('SPOT_NOT_FOUND');
  }

  const conflictTarget = spotId
    ? '(owner_id, manager_id, spot_id) WHERE spot_id IS NOT NULL'
    : '(owner_id, manager_id) WHERE spot_id IS NULL';

  const { rows } = await query(
    `INSERT INTO host_managers
       (owner_id, manager_id, spot_id, can_manage_bookings, can_manage_spots, can_view_reports, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT ${conflictTarget}
     DO UPDATE SET
       can_manage_bookings = EXCLUDED.can_manage_bookings,
       can_manage_spots = EXCLUDED.can_manage_spots,
       can_view_reports = EXCLUDED.can_view_reports,
       is_active = true,
       updated_at = now()
     RETURNING *`,
    [
      ownerId,
      manager.id,
      spotId || null,
      normalizeBool(canManageBookings, true),
      normalizeBool(canManageSpots, true),
      normalizeBool(canViewReports, false),
    ]
  );

  return getManagerById(rows[0].id, ownerId);
}

export async function updateManager(ownerId, managerAssignmentId, fields = {}) {
  const updates = [];
  const params = [managerAssignmentId, ownerId];

  if (fields.canManageBookings !== undefined) {
    params.push(normalizeBool(fields.canManageBookings, true));
    updates.push(`can_manage_bookings = $${params.length}`);
  }
  if (fields.canManageSpots !== undefined) {
    params.push(normalizeBool(fields.canManageSpots, true));
    updates.push(`can_manage_spots = $${params.length}`);
  }
  if (fields.canViewReports !== undefined) {
    params.push(normalizeBool(fields.canViewReports, false));
    updates.push(`can_view_reports = $${params.length}`);
  }
  if (fields.isActive !== undefined) {
    params.push(normalizeBool(fields.isActive, true));
    updates.push(`is_active = $${params.length}`);
  }

  if (!updates.length) return getManagerById(managerAssignmentId, ownerId);

  const { rows } = await query(
    `UPDATE host_managers
     SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $1 AND owner_id = $2
     RETURNING id`,
    params
  );
  if (!rows[0]) return null;
  return getManagerById(managerAssignmentId, ownerId);
}

export async function removeManager(ownerId, managerAssignmentId) {
  const { rows } = await query(
    `UPDATE host_managers
     SET is_active = false, updated_at = now()
     WHERE id = $1 AND owner_id = $2
     RETURNING id`,
    [managerAssignmentId, ownerId]
  );
  return rows[0] ? getManagerById(managerAssignmentId, ownerId) : null;
}

async function getManagerById(id, ownerId) {
  const { rows } = await query(
    `SELECT hm.*,
            u.name AS manager_name,
            u.username AS manager_username,
            u.telegram_id AS manager_telegram_id,
            s.address AS spot_address
     FROM host_managers hm
     JOIN users u ON u.id = hm.manager_id
     LEFT JOIN spots s ON s.id = hm.spot_id
     WHERE hm.id = $1 AND hm.owner_id = $2`,
    [id, ownerId]
  );
  return rows[0] || null;
}
