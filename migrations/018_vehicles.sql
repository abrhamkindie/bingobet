-- ============================================================
-- 018_vehicles.sql  —  Vehicle management for drivers
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate_number  TEXT NOT NULL,
  vehicle_type  TEXT NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'motorcycle', 'suv', 'truck')),
  color         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles (user_id);

-- Only one default vehicle per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_default
  ON vehicles (user_id) WHERE is_default = true;

DROP TRIGGER IF EXISTS trg_vehicles_updated ON vehicles;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add vehicle_id to bookings (optional — null for legacy bookings)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings (vehicle_id);
