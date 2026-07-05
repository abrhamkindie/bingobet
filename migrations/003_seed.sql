-- ============================================================
-- 003_seed.sql  —  BetBingo seed data
-- ============================================================

-- Insert a bootstrap admin (password: admin123 — change immediately)
INSERT INTO admin_users (email, password_hash, name, role)
VALUES (
  'admin@betbingo.com',
  '$2b$12$LJ3m4ys3Lg4YOAQ1Dl1KZePWBJ0Yw1hG1Kxq1dG5K1Z1dG5K1Z1dO',  -- admin123
  'Admin',
  'superadmin'
) ON CONFLICT (email) DO NOTHING;

-- Sample game round
INSERT INTO game_rounds (
  title, description, status, ticket_price, max_tickets,
  max_tickets_per_player, number_min, number_max,
  numbers_per_ticket, numbers_to_draw, draw_type,
  prize_tiers, platform_fee_percent
) VALUES (
  'BetBingo Launch Special',
  'Welcome to BetBingo! Pick 6 numbers from 1-50. Match 3+ to win!',
  'active',
  50.00,    -- 50 ETB per ticket
  500,      -- max 500 tickets
  5,        -- max 5 per player
  1, 50,    -- numbers 1-50
  6,        -- 6 per ticket
  6,        -- draw 6 numbers
  'scheduled',
  '[
    {"match": 3, "payout_multiplier": 2, "label": "Match 3 - 2x"},
    {"match": 4, "payout_multiplier": 10, "label": "Match 4 - 10x"},
    {"match": 5, "payout_multiplier": 50, "label": "Match 5 - 50x"},
    {"match": 6, "payout_multiplier": 0, "label": "JACKPOT!", "is_jackpot": true}
  ]'::jsonb,
  10        -- 10% platform fee
) ON CONFLICT DO NOTHING;
