-- ============================================================
-- 016_auto_category.sql  —  AI-predicted ticket category
-- ============================================================

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS auto_category ticket_category;
