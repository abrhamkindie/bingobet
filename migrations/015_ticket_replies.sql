-- ============================================================
-- 015_ticket_replies.sql  —  Admin ↔ User ticket conversation
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_replies (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  admin_id        BIGINT REFERENCES admin_users(id),
  user_id         BIGINT REFERENCES users(id),
  message         TEXT NOT NULL,
  is_from_admin   BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies (ticket_id, created_at);

-- Update support_tickets.updated_at when a reply is added
CREATE OR REPLACE FUNCTION touch_ticket_on_reply()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_replies_touch ON ticket_replies;
CREATE TRIGGER trg_ticket_replies_touch AFTER INSERT ON ticket_replies
  FOR EACH ROW EXECUTE FUNCTION touch_ticket_on_reply();
