-- ============================================================
-- 013_seed_admin.sql  —  Seed an admin dashboard account
-- Password: admin123
-- ============================================================

INSERT INTO admin_users (email, password_hash, name, role)
VALUES (
  'admin@parkaddis.com',
  '$2b$12$LawrukPQID2O2A9q7rbY5O3Wm9W7CjxglsziULW976EG/wOiqjBnO',
  'Admin',
  'superadmin'
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      name          = EXCLUDED.name,
      role          = EXCLUDED.role,
      is_active     = true;
