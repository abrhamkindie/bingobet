import { query } from '../index.js';

const ALLOWED_METADATA_TYPES = new Set(['string', 'number', 'boolean']);

function sanitizeMetadata(metadata = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value == null) continue;
    if (ALLOWED_METADATA_TYPES.has(typeof value)) {
      clean[key] = value;
    }
  }
  return clean;
}

export async function trackEvent({ userId, telegramId, updateId, eventName, metadata }) {
  if (!eventName) return null;
  const { rows } = await query(
    `INSERT INTO bot_events (user_id, telegram_id, update_id, event_name, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      userId || null,
      telegramId || null,
      updateId || null,
      eventName,
      JSON.stringify(sanitizeMetadata(metadata)),
    ]
  );
  return rows[0] || null;
}

export async function getBotUsageSummary({ days = 30 } = {}) {
  const { rows } = await query(
    `WITH bounds AS (
       SELECT
         now() - ($1::int * interval '1 day') AS since,
         now() - interval '1 day' AS yesterday,
         now() - interval '7 days' AS week_since
     ),
     base AS (
       SELECT * FROM bot_events WHERE created_at >= (SELECT since FROM bounds)
     )
     SELECT
       (SELECT COUNT(*) FROM base) AS total_events,
       (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM base) AS unique_users,
       (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM base WHERE created_at >= (SELECT week_since FROM bounds)) AS weekly_active_users,
       (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM base WHERE created_at >= (SELECT yesterday FROM bounds)) AS daily_active_users,
       (SELECT COUNT(*) FROM base WHERE event_name = 'bot_start') AS starts,
       (SELECT COUNT(*) FROM base WHERE event_name = 'nearby_results') AS searches,
       (SELECT COUNT(*) FROM base WHERE event_name = 'booking_created') AS bookings_created,
       (SELECT COUNT(*) FROM base WHERE event_name = 'payment_initiated') AS payments_initiated,
       (SELECT COUNT(*) FROM base WHERE event_name = 'support_ticket_created') AS support_tickets,
       (SELECT MAX(created_at) FROM bot_events) AS last_event_at`,
    [days]
  );
  return rows[0] || {};
}

export async function getBotUsageTrend({ days = 14 } = {}) {
  const { rows } = await query(
    `WITH series AS (
       SELECT generate_series(
         date_trunc('day', now()) - (($1::int - 1) * interval '1 day'),
         date_trunc('day', now()),
         interval '1 day'
       ) AS day
     ),
     events AS (
       SELECT date_trunc('day', created_at) AS day,
              COUNT(*) AS event_count,
              COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) AS active_users
       FROM bot_events
       WHERE created_at >= date_trunc('day', now()) - (($1::int - 1) * interval '1 day')
       GROUP BY 1
     )
     SELECT TO_CHAR(s.day, 'YYYY-MM-DD') AS period,
            COALESCE(e.event_count, 0) AS event_count,
            COALESCE(e.active_users, 0) AS active_users
     FROM series s
     LEFT JOIN events e ON e.day = s.day
     ORDER BY s.day DESC`,
    [days]
  );
  return rows;
}

export async function getBotEventBreakdown({ days = 30, limit = 12 } = {}) {
  const { rows } = await query(
    `SELECT event_name, COUNT(*) AS count
     FROM bot_events
     WHERE created_at >= now() - ($1::int * interval '1 day')
     GROUP BY event_name
     ORDER BY count DESC, event_name ASC
     LIMIT $2`,
    [days, limit]
  );
  return rows;
}

export async function getBotFunnel({ days = 30 } = {}) {
  const { rows } = await query(
    `SELECT step, label, count
     FROM (
       VALUES
         (1, 'Started', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name = 'bot_start')),
         (2, 'Location shared', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name = 'location_shared')),
         (3, 'Spots viewed', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name IN ('nearby_results', 'spot_viewed'))),
         (4, 'Booking started', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name = 'booking_started')),
         (5, 'Booking created', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name = 'booking_created')),
         (6, 'Payment started', (SELECT COUNT(DISTINCT COALESCE(user_id::text, telegram_id::text)) FROM bot_events WHERE created_at >= now() - ($1::int * interval '1 day') AND event_name = 'payment_initiated'))
     ) AS f(step, label, count)
     ORDER BY step`,
    [days]
  );
  return rows;
}
