-- ============================================================
-- 020_pending_booking_holds.sql
-- Pending unpaid bookings are short-lived payment holds. They
-- must consume capacity until paid or auto-cancelled, otherwise
-- two drivers can pay for the same slot at the same time.
-- ============================================================

CREATE OR REPLACE FUNCTION count_overlapping_bookings(
  p_spot_id BIGINT,
  p_start   TIMESTAMPTZ,
  p_end     TIMESTAMPTZ
)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM bookings b
  WHERE b.spot_id = p_spot_id
    AND b.status IN ('pending', 'reserved', 'confirmed', 'active')
    AND tstzrange(b.start_time, b.end_time) && tstzrange(p_start, p_end);
$$ LANGUAGE sql STABLE;

DROP INDEX IF EXISTS idx_bookings_active_window;
CREATE INDEX IF NOT EXISTS idx_bookings_active_window ON bookings (spot_id, start_time, end_time)
  WHERE status IN ('pending', 'reserved', 'confirmed', 'active');
