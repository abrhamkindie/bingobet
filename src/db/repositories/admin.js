import { query } from '../index.js';

export async function getByEmail(email) {
  const { rows } = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function getById(id) {
  const { rows } = await query('SELECT * FROM admin_users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createAdmin({ email, passwordHash, name, role }) {
  const { rows } = await query(
    `INSERT INTO admin_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email, passwordHash, name, role]
  );
  return rows[0];
}

export async function updateLastLogin(id) {
  const { rows } = await query(
    `UPDATE admin_users SET updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}
