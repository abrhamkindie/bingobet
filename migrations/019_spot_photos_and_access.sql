-- ============================================================
-- 019_spot_photos_and_access.sql  —  Multiple photos + access instructions
-- ============================================================

-- Add access_instructions column to spots
ALTER TABLE spots ADD COLUMN IF NOT EXISTS access_instructions TEXT;

-- Create spot_photos table for multiple photos
CREATE TABLE IF NOT EXISTS spot_photos (
  id          BIGSERIAL PRIMARY KEY,
  spot_id     BIGINT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  file_id     TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spot_photos_spot ON spot_photos (spot_id);

-- Migrate existing spot photo data. Older databases used photo_file_id; the
-- current schema stores photo IDs in spots.photos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'spots'
      AND column_name = 'photo_file_id'
  ) THEN
    EXECUTE '
      INSERT INTO spot_photos (spot_id, file_id, is_primary)
      SELECT id, photo_file_id, true
      FROM spots
      WHERE photo_file_id IS NOT NULL
      ON CONFLICT DO NOTHING
    ';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'spots'
      AND column_name = 'photos'
  ) THEN
    INSERT INTO spot_photos (spot_id, file_id, is_primary)
    SELECT s.id, photo.file_id, photo.ordinality = 1
    FROM spots s
    CROSS JOIN LATERAL unnest(s.photos) WITH ORDINALITY AS photo(file_id, ordinality)
    WHERE photo.file_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
