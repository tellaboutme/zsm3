export const INSERT_SHORT_LINK = `INSERT INTO short_links
  (code, target_url, password_salt, password_hash, created_by, created_at, expires_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`;

export const AUDIT_SHORT_LINK_CREATE = `INSERT INTO audit_log
  (id, at, actor_email, action, entity, entity_id, details_json)
  SELECT ?1, ?2, ?3, 'short_link.create', 'short_link', code, ?4 FROM short_links
  WHERE code = ?5 AND created_by = ?3`;

export const INSERT_FILE_SHORT_LINK = `INSERT INTO short_links
  (code, target_url, password_salt, password_hash, created_by, created_at, expires_at)
  SELECT ?1, '', ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (SELECT 1 FROM short_link_files
  WHERE object_key = ?7 AND created_by = ?4 AND code IS NULL AND removed_at IS NULL)`;

export const ATTACH_SHORT_LINK_FILE = `UPDATE short_link_files SET code = ?1
  WHERE object_key = ?2 AND created_by = ?3 AND code IS NULL AND removed_at IS NULL`;

export const SELECT_SHORT_LINK = `SELECT l.code, l.target_url, l.password_salt, l.password_hash,
  l.expires_at, l.revoked_at, f.object_key, f.name AS file_name, f.format AS file_format,
  f.bytes AS file_bytes FROM short_links l LEFT JOIN short_link_files f ON f.code = l.code
  WHERE l.code = ?1`;

export const COUNT_CLICK = "UPDATE short_links SET clicks = clicks + 1 WHERE code = ?1";

export const REVOKE_SHORT_LINK =
  "UPDATE short_links SET revoked_at = ?3 WHERE code = ?1 AND created_by = ?2 AND revoked_at IS NULL";

export const AUDIT_SHORT_LINK_REVOKE = `INSERT INTO audit_log
  (id, at, actor_email, action, entity, entity_id, details_json)
  SELECT ?1, ?2, ?3, 'short_link.revoke', 'short_link', code, ?4 FROM short_links
  WHERE code = ?5 AND created_by = ?3 AND revoked_at IS NULL`;

const AUTHOR_COLUMNS = `SELECT l.code, l.target_url, l.created_at, l.expires_at, l.revoked_at,
  l.clicks, (l.password_hash IS NOT NULL) AS password_protected, f.name AS file_name,
  f.format AS file_format, f.bytes AS file_bytes
  FROM short_links l LEFT JOIN short_link_files f ON f.code = l.code`;

export const SELECT_AUTHOR_LINKS = `${AUTHOR_COLUMNS} WHERE l.created_by = ?1
  ORDER BY l.created_at DESC, l.code LIMIT ?2`;

export const SELECT_AUTHOR_LINKS_PAGE = `${AUTHOR_COLUMNS}
  WHERE l.created_by = ?1 AND (?2 IS NULL OR l.created_at < ?2 OR (l.created_at = ?2 AND l.code > ?3))
  ORDER BY l.created_at DESC, l.code ASC LIMIT ?4`;

export const SELECT_CREATED_LINK = `${AUTHOR_COLUMNS} WHERE l.code = ?1 AND l.created_by = ?2`;

export const DELETE_LAPSED_SHORT_LINKS = `DELETE FROM short_links WHERE code IN
  (SELECT code FROM short_links WHERE expires_at < ?1 OR revoked_at < ?1
   ORDER BY expires_at LIMIT ?2)`;

export const INSERT_PENDING_FILE = `INSERT INTO short_link_files
  (object_key, code, name, format, bytes, created_by, created_at)
  VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6)`;

export const DISCARD_PENDING_FILE =
  "DELETE FROM short_link_files WHERE object_key = ?1 AND code IS NULL";

export const SELECT_STALE_FILES = `SELECT f.object_key FROM short_link_files f
  LEFT JOIN short_links l ON l.code = f.code
  WHERE f.removed_at IS NULL AND ((f.code IS NULL AND f.created_at < ?1)
    OR (f.code IS NOT NULL AND (l.code IS NULL OR l.revoked_at IS NOT NULL OR l.expires_at <= ?2)))
  ORDER BY f.created_at LIMIT ?3`;

export const MARK_FILE_REMOVED =
  "UPDATE short_link_files SET removed_at = ?2 WHERE object_key = ?1 AND removed_at IS NULL";

export const DELETE_DETACHED_FILES = `DELETE FROM short_link_files WHERE removed_at IS NOT NULL
  AND (code IS NULL OR code NOT IN (SELECT code FROM short_links))`;
