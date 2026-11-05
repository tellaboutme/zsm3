export const SELECT_ACTIVE_LINKS_PAGE = `SELECT code, created_by, created_at, expires_at,
  (password_hash IS NOT NULL) AS password_protected, (target_url = '') AS is_file
  FROM short_links WHERE revoked_at IS NULL AND expires_at > ?1
  AND (?2 IS NULL OR created_at < ?2 OR (created_at = ?2 AND code > ?3))
  ORDER BY created_at DESC, code ASC LIMIT ?4`;

export const AUDIT_ADMIN_REVOKE = `INSERT INTO audit_log
  (id, at, actor_email, action, entity, entity_id, details_json)
  SELECT ?1, ?2, ?3, 'short_link.admin_revoke', 'short_link', code,
  json_object('revoked_at', ?2, 'owner', created_by) FROM short_links
  WHERE code = ?4 AND revoked_at IS NULL AND expires_at > ?2`;

export const ADMIN_REVOKE_SHORT_LINK = `UPDATE short_links SET revoked_at = ?2
  WHERE code = ?1 AND revoked_at IS NULL AND expires_at > ?2`;
