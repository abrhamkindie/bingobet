-- ============================================================
-- 021_host_listing_review.sql — Rich host listing review metadata
-- ============================================================

ALTER TABLE spots ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES admin_users(id);
ALTER TABLE spots ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS rejected_by BIGINT REFERENCES admin_users(id);

CREATE INDEX IF NOT EXISTS idx_spots_pending_review
  ON spots (created_at DESC)
  WHERE status = 'pending_approval';
