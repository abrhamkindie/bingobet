-- ============================================================
-- 005_instant_games.sql — Keno + Spin Wheel (instant house games)
-- ============================================================

-- Generic bet/payout ledger types for instant games (added, not used in this tx).
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bet';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'payout';

-- ------------------------------------------------------------
-- instant_bets — one row per Keno/Spin play (audit + history)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instant_bets (
  id           BIGSERIAL PRIMARY KEY,
  player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_type    TEXT   NOT NULL CHECK (game_type IN ('keno', 'spin')),
  stake        NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  payout       NUMERIC(12,2) NOT NULL DEFAULT 0,
  multiplier   NUMERIC(10,3) NOT NULL DEFAULT 0,
  outcome      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_instant_bets_player ON instant_bets (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instant_bets_type ON instant_bets (game_type);

-- ------------------------------------------------------------
-- Default config (admin-tunable via the settings table)
-- ------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('instant_min_stake', '10'),
  ('instant_max_stake', '1000'),
  ('keno_pool',       '40'),
  ('keno_draw',       '10'),
  ('keno_max_spots',  '8'),
  ('keno_paytable', '{
    "1": {"1": 3.2},
    "2": {"1": 1, "2": 8},
    "3": {"2": 2, "3": 16},
    "4": {"2": 1, "3": 4, "4": 40},
    "5": {"3": 2, "4": 8, "5": 80},
    "6": {"3": 1, "4": 4, "5": 15, "6": 120},
    "7": {"4": 2, "5": 8, "6": 30, "7": 300},
    "8": {"4": 1, "5": 4, "6": 15, "7": 60, "8": 600}
  }'::jsonb),
  ('spin_segments', '[
    {"mult": 0,  "weight": 495, "color": "#334155"},
    {"mult": 1,  "weight": 225, "color": "#0d9488"},
    {"mult": 1.5,"weight": 140, "color": "#14b8a6"},
    {"mult": 2,  "weight": 80,  "color": "#2dd4bf"},
    {"mult": 3,  "weight": 35,  "color": "#22d3ee"},
    {"mult": 5,  "weight": 18,  "color": "#f59e0b"},
    {"mult": 10, "weight": 6,   "color": "#fbbf24"},
    {"mult": 50, "weight": 1,   "color": "#f43f5e"}
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
