export const SELECT_ALBUMS = `SELECT a.id, a.school_year, a.slug, a.title, a.description,
  a.published_at, a.updated_at,
  (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.deleted_at IS NULL) AS photo_count
  FROM albums a WHERE a.deleted_at IS NULL AND (?1 IS NULL OR a.school_year = ?1)
  ORDER BY a.school_year DESC, a.created_at DESC, a.id DESC LIMIT ?2`;

export const SELECT_ALBUM = `SELECT a.id, a.school_year, a.slug, a.title, a.description,
  a.published_at, a.updated_at,
  (SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id AND p.deleted_at IS NULL) AS photo_count
  FROM albums a WHERE a.deleted_at IS NULL AND a.id = ?`;

export const SELECT_ALBUM_ID = `SELECT id FROM albums
  WHERE school_year = ? AND slug = ? AND deleted_at IS NULL`;

export const INSERT_ALBUM = `INSERT INTO albums
  (id, school_year, slug, title, description, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export const UPDATE_ALBUM = `UPDATE albums
  SET school_year = ?, slug = ?, title = ?, description = ?, updated_at = ?
  WHERE id = ? AND deleted_at IS NULL`;

export const PUBLISH_ALBUM = `UPDATE albums SET published_at = ?, updated_at = ?
  WHERE id = ? AND deleted_at IS NULL`;

export const DELETE_ALBUM = `UPDATE albums SET deleted_at = ?1, published_at = NULL, updated_at = ?1
  WHERE id = ?2 AND deleted_at IS NULL`;

export const REFRESH_ALBUM = `UPDATE albums SET updated_at = ?1,
  published_at = CASE
    WHEN EXISTS (SELECT 1 FROM photos WHERE album_id = ?2 AND deleted_at IS NULL) THEN published_at
    ELSE NULL
  END
  WHERE id = ?2`;

export const SELECT_PHOTOS = `SELECT id, album_id, position, width, height, alt, sha256,
  consent_by, consent_at, created_at FROM photos
  WHERE album_id = ? AND deleted_at IS NULL ORDER BY position, id LIMIT ?`;

export const SELECT_PHOTO = `SELECT id, album_id, position, width, height, alt, sha256,
  consent_by, consent_at, created_at FROM photos
  WHERE album_id = ? AND id = ? AND deleted_at IS NULL`;

export const SELECT_PHOTO_BY_HASH = `SELECT p.id, p.album_id, p.position, p.width, p.height, p.alt,
  p.sha256, p.consent_by, p.consent_at, p.created_at,
  p.deleted_at IS NULL AND a.deleted_at IS NULL AS live
  FROM photos p JOIN albums a ON a.id = p.album_id WHERE p.sha256 = ?`;

export const INSERT_PHOTO = `INSERT INTO photos
  (id, album_id, position, width, height, alt, sha256, consent_by, consent_at, created_by,
    created_at)
  VALUES (?1, ?2, (SELECT COALESCE(MAX(position), -1) + 1 FROM photos WHERE album_id = ?2),
    ?3, ?4, ?5, ?6, ?7, ?8, ?7, ?8)`;

export const RESTORE_PHOTO = `UPDATE photos SET album_id = ?1,
  position = (SELECT COALESCE(MAX(position), -1) + 1 FROM photos WHERE album_id = ?1),
  alt = ?2, consent_by = ?3, consent_at = ?4, deleted_at = NULL
  WHERE id = ?5`;

export const UPDATE_PHOTO_ALT = "UPDATE photos SET alt = ? WHERE id = ? AND deleted_at IS NULL";

export const DELETE_PHOTO = "UPDATE photos SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL";
