export const INSERT_SHORT_LINK = `INSERT INTO short_links
  (code, target_url, password_salt, password_hash, created_by, created_at, expires_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`;

export const SELECT_SHORT_LINK = `SELECT code, target_url, password_salt, password_hash,
  expires_at, revoked_at FROM short_links WHERE code = ?1`;

export const COUNT_CLICK = "UPDATE short_links SET clicks = clicks + 1 WHERE code = ?1";

export const REVOKE_SHORT_LINK =
  "UPDATE short_links SET revoked_at = ?2 WHERE code = ?1 AND revoked_at IS NULL";

export const SELECT_AUTHOR_LINKS = `SELECT code, target_url, password_salt, password_hash,
  expires_at, revoked_at FROM short_links WHERE created_by = ?1
  ORDER BY created_at DESC, code LIMIT ?2`;

export const DELETE_LAPSED_SHORT_LINKS = `DELETE FROM short_links WHERE code IN
  (SELECT code FROM short_links WHERE expires_at < ?1 OR revoked_at < ?1
   ORDER BY expires_at LIMIT ?2)`;
