-- ============================================================
-- 014_support_tickets.sql  —  User-submitted support requests
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM (
    'payment',
    'booking',
    'host',
    'feature',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category        ticket_category NOT NULL,
  description     TEXT NOT NULL,
  screenshot_file_id TEXT,               -- optional Telegram file_id
  status          ticket_status NOT NULL DEFAULT 'open',
  assigned_to     BIGINT REFERENCES admin_users(id),
  admin_notes     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user    ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets (status);

DROP TRIGGER IF EXISTS trg_support_tickets_updated ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
