-- ============================================================
-- 001_init.sql  —  Core schema for BetBingo Lottery Bot
-- Requires: PostgreSQL 14+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE player_role       AS ENUM ('player', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE language_pref     AS ENUM ('en', 'am');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE game_status       AS ENUM ('upcoming', 'active', 'drawing', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE draw_type         AS ENUM ('scheduled', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status     AS ENUM ('active', 'won', 'lost', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type  AS ENUM ('deposit', 'ticket_purchase', 'winnings', 'withdrawal', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_state AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- updated_at helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- players  (Telegram users who play BetBingo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id                  BIGSERIAL PRIMARY KEY,
  telegram_id         BIGINT      NOT NULL UNIQUE,
  name                TEXT,
  username            TEXT,
  phone               TEXT,
  role                player_role NOT NULL DEFAULT 'player',
  language_pref       language_pref NOT NULL DEFAULT 'en',
  is_banned           BOOLEAN     NOT NULL DEFAULT false,
  ban_reason          TEXT,
  wallet_balance      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  total_tickets_bought INTEGER   NOT NULL DEFAULT 0,
  total_won           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spent         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_telegram_id ON players (telegram_id);
CREATE INDEX IF NOT EXISTS idx_players_role ON players (role);

DROP TRIGGER IF EXISTS trg_players_updated ON players;
CREATE TRIGGER trg_players_updated BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- admin_users  (dashboard login via email + password / JWT)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',   -- 'admin' | 'superadmin'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_admin_users_updated ON admin_users;
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- game_rounds  (lottery/bingo game sessions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_rounds (
  id                    BIGSERIAL PRIMARY KEY,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                game_status NOT NULL DEFAULT 'upcoming',
  ticket_price          NUMERIC(10,2) NOT NULL CHECK (ticket_price > 0),
  max_tickets           INTEGER NOT NULL DEFAULT 1000 CHECK (max_tickets > 0),
  max_tickets_per_player INTEGER NOT NULL DEFAULT 10 CHECK (max_tickets_per_player > 0),
  number_min            INTEGER NOT NULL DEFAULT 1,
  number_max            INTEGER NOT NULL DEFAULT 50,
  numbers_per_ticket    INTEGER NOT NULL DEFAULT 6,
  numbers_to_draw       INTEGER NOT NULL DEFAULT 6,
  draw_type             draw_type NOT NULL DEFAULT 'scheduled',
  scheduled_draw_at     TIMESTAMPTZ,
  draw_interval_minutes INTEGER CHECK (draw_interval_minutes IS NULL OR draw_interval_minutes > 0),
  prize_pool            NUMERIC(14,2) NOT NULL DEFAULT 0,
  platform_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  platform_fee          NUMERIC(14,2) NOT NULL DEFAULT 0,
  jackpot_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  winner_count          INTEGER NOT NULL DEFAULT 0,
  total_payout          NUMERIC(14,2) NOT NULL DEFAULT 0,
  tickets_sold          INTEGER NOT NULL DEFAULT 0,
  prize_tiers           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example prize_tiers: [{"match": 3, "payout_multiplier": 2, "label": "Match 3"}, ...]
  drawn_at              TIMESTAMPTZ,
  created_by            BIGINT REFERENCES admin_users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (number_max > number_min),
  CHECK (numbers_per_ticket <= (number_max - number_min + 1)),
  CHECK (numbers_to_draw <= (number_max - number_min + 1)),
  CHECK (numbers_per_ticket >= 1),
  CHECK (numbers_to_draw >= 1)
);
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON game_rounds (status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_draw_time ON game_rounds (scheduled_draw_at)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_game_rounds_updated ON game_rounds;
CREATE TRIGGER trg_game_rounds_updated BEFORE UPDATE ON game_rounds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- tickets  (purchased lottery entries)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id                BIGSERIAL PRIMARY KEY,
  game_round_id     BIGINT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  player_id         BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  numbers           INTEGER[] NOT NULL DEFAULT '{}',
  matched_count     INTEGER NOT NULL DEFAULT 0,
  prize_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_winner         BOOLEAN NOT NULL DEFAULT false,
  status            ticket_status NOT NULL DEFAULT 'active',
  position          INTEGER NOT NULL DEFAULT 0,   -- ticket # in this round
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_game ON tickets (game_round_id);
CREATE INDEX IF NOT EXISTS idx_tickets_player ON tickets (player_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_game_player ON tickets (game_round_id, player_id);

-- ------------------------------------------------------------
-- drawn_numbers  (numbers drawn per round)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drawn_numbers (
  id            BIGSERIAL PRIMARY KEY,
  game_round_id BIGINT NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  number        INTEGER NOT NULL,
  position      INTEGER NOT NULL,     -- draw order (1st, 2nd, etc.)
  drawn_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_round_id, number),
  UNIQUE (game_round_id, position)
);
CREATE INDEX IF NOT EXISTS idx_drawn_numbers_game ON drawn_numbers (game_round_id);

-- ------------------------------------------------------------
-- transactions  (financial ledger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                  BIGSERIAL PRIMARY KEY,
  player_id           BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type                transaction_type NOT NULL,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_before      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_after       NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference           TEXT,
  status              transaction_state NOT NULL DEFAULT 'pending',
  ticket_id           BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
  game_round_id       BIGINT REFERENCES game_rounds(id) ON DELETE SET NULL,
  -- Chapa payment fields
  chapa_tx_ref        TEXT,
  chapa_checkout_url  TEXT,
  raw                 JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions (player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_reference
  ON transactions (reference) WHERE reference IS NOT NULL;

DROP TRIGGER IF EXISTS trg_transactions_updated ON transactions;
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- settings  (runtime config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_settings_updated ON settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Default settings
-- ------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('platform_fee_percent', '10'),
  ('min_withdrawal', '50'),
  ('default_ticket_price', '50'),
  ('max_tickets_per_game', '1000'),
  ('game_name', '"BetBingo"')
ON CONFLICT (key) DO NOTHING;
