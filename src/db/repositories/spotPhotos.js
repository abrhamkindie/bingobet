import { query } from '../index.js';

// Add a photo to a spot.
export async function addPhoto(spotId, fileId, isPrimary = false) {
  // If this is the first photo or marked as primary, unset others
  if (isPrimary) {
    await query(
      `UPDATE spot_photos SET is_primary = false WHERE spot_id = $1`,
      [spotId]
    );
  }

  const { rows } = await query(
    `INSERT INTO spot_photos (spot_id, file_id, is_primary)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [spotId, fileId, isPrimary]
  );
  return rows[0];
}

// Get all photos for a spot.
export async function getPhotos(spotId) {
  const { rows } = await query(
    `SELECT * FROM spot_photos WHERE spot_id = $1 ORDER BY is_primary DESC, created_at ASC`,
    [spotId]
  );
  return rows;
}

// Get primary photo for a spot.
export async function getPrimaryPhoto(spotId) {
  const { rows } = await query(
    `SELECT * FROM spot_photos WHERE spot_id = $1 AND is_primary = true LIMIT 1`,
    [spotId]
  );
  return rows[0] || null;
}

// Delete a photo.
export async function deletePhoto(id, spotId) {
  const { rows } = await query(
    `DELETE FROM spot_photos WHERE id = $1 AND spot_id = $2 RETURNING *`,
    [id, spotId]
  );
  return rows[0] || null;
}

// Set a photo as primary.
export async function setPrimary(id, spotId) {
  await query(
    `UPDATE spot_photos SET is_primary = false WHERE spot_id = $1`,
    [spotId]
  );
  const { rows } = await query(
    `UPDATE spot_photos SET is_primary = true WHERE id = $1 AND spot_id = $2 RETURNING *`,
    [id, spotId]
  );
  return rows[0] || null;
}

// Update access instructions for a spot.
export async function updateAccessInstructions(spotId, instructions) {
  const { rows } = await query(
    `UPDATE spots SET access_instructions = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [spotId, instructions]
  );
  return rows[0] || null;
}
