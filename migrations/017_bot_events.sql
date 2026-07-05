-- ============================================================
-- 017_bot_events.sql  —  Telegram bot usage analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT,
  update_id   BIGINT,
  event_name  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'telegram_bot',
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_events_created_at
  ON bot_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_events_event_created
  ON bot_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_events_user_created
  ON bot_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_events_update_id
  ON bot_events (update_id);
