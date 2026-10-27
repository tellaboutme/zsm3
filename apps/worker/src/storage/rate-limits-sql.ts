export const CONSUME_RATE_LIMIT = `INSERT INTO rate_limits (key_hash, window_started_at, count)
  VALUES (?1, ?2, 1)
  ON CONFLICT (key_hash) DO UPDATE SET
    window_started_at = CASE WHEN window_started_at < ?3 THEN ?2 ELSE window_started_at END,
    count = CASE WHEN window_started_at < ?3 THEN 1 ELSE count + 1 END
  RETURNING count, window_started_at`;

export const PRUNE_RATE_LIMITS = `DELETE FROM rate_limits WHERE key_hash IN
  (SELECT key_hash FROM rate_limits WHERE window_started_at < ?1 ORDER BY window_started_at LIMIT ?2)`;

export const CLEAR_RATE_LIMIT = "DELETE FROM rate_limits WHERE key_hash = ?1";
