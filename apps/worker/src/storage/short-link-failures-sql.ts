export const RESERVE_FAILURE = `INSERT INTO short_link_failures (code, attempted_at)
  SELECT ?1, ?2
  WHERE (SELECT count(*) FROM short_link_failures WHERE code = ?1 AND attempted_at >= ?3) < ?4
  RETURNING id`;

export const RELEASE_FAILURE = "DELETE FROM short_link_failures WHERE id = ?1";

export const PRUNE_FAILURES = `DELETE FROM short_link_failures WHERE id IN
  (SELECT id FROM short_link_failures WHERE attempted_at < ?1 ORDER BY attempted_at LIMIT ?2)`;
