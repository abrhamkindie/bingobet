-- ============================================================
-- 022_host_managers_reports.sql
-- Host manager delegation + immediate paid-booking notification tracking.
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS notification_host_new_booking BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_notification_host_new_booking
  ON bookings (notification_host_new_booking, payment_status, status, updated_at)
  WHERE notification_host_new_booking = false;

COMMENT ON COLUMN bookings.notification_host_new_booking IS
  'True when the host/assigned managers were notified about a newly paid booking';

CREATE TABLE IF NOT EXISTS host_managers (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spot_id             BIGINT REFERENCES spots(id) ON DELETE CASCADE,
  can_manage_bookings BOOLEAN NOT NULL DEFAULT true,
  can_manage_spots    BOOLEAN NOT NULL DEFAULT true,
  can_view_reports    BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (owner_id <> manager_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_host_managers_all_spots
  ON host_managers (owner_id, manager_id)
  WHERE spot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_host_managers_one_spot
  ON host_managers (owner_id, manager_id, spot_id)
  WHERE spot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_host_managers_owner
  ON host_managers (owner_id, is_active);

CREATE INDEX IF NOT EXISTS idx_host_managers_manager
  ON host_managers (manager_id, is_active);

CREATE INDEX IF NOT EXISTS idx_host_managers_spot
  ON host_managers (spot_id, is_active);

DROP TRIGGER IF EXISTS trg_host_managers_updated ON host_managers;
CREATE TRIGGER trg_host_managers_updated BEFORE UPDATE ON host_managers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE host_managers IS
  'Delegates host operations from a spot owner to another Telegram user, optionally limited to one spot.';
