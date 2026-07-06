-- ============================================================
-- 004_miniapp_features.sql — Daily reward, referrals, leaderboard support
-- ============================================================

-- New transaction types for bonus credits (safe inside a tx on PG12+; the new
-- values are NOT used within this migration).
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bonus';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_bonus';

-- ------------------------------------------------------------
-- players: daily reward + referral columns
-- ------------------------------------------------------------
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS last_daily_claim_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_streak        INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code       TEXT,
  ADD COLUMN IF NOT EXISTS referred_by         BIGINT       REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_count      INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earned     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_rewarded   BOOLEAN      NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_players_referral_code
  ON players (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_referred_by ON players (referred_by);
CREATE INDEX IF NOT EXISTS idx_players_total_won ON players (total_won DESC);

-- ------------------------------------------------------------
-- Default settings for the new features
-- ------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('daily_reward_base',    '10'),   -- base ETB granted per daily claim
  ('daily_streak_bonus',   '5'),    -- extra ETB per consecutive streak day
  ('daily_streak_max',     '7'),    -- streak days after which the bonus caps
  ('referral_bonus_amount','25')    -- ETB paid to referrer on referee's 1st deposit
ON CONFLICT (key) DO NOTHING;
