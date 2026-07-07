-- ============================================================
-- 006_roulette.sql — European Roulette instant game
-- ============================================================

-- Expand the game_type check constraint to include 'roulette'
ALTER TABLE instant_bets DROP CONSTRAINT IF EXISTS instant_bets_game_type_check;
ALTER TABLE instant_bets ADD CONSTRAINT instant_bets_game_type_check
  CHECK (game_type IN ('keno', 'spin', 'roulette'));

-- Roulette doesn't need extra settings tables — it uses the existing
-- instant_min_stake / instant_max_stake settings and derives everything
-- from the service code.
