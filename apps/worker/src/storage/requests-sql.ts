const COLUMNS =
  "id, type, status, pii_ciphertext, pii_key_id, email_index, pii_erased_at, status_token_hash, form_key, staff_note, created_at, updated_at, closed_at";

export const INSERT_REQUEST = `INSERT INTO requests
  (id, type, status, pii_ciphertext, pii_key_id, email_index, status_token_hash, form_key, created_at, updated_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`;

export const INSERT_REQUEST_WITH_LIMIT = `INSERT INTO requests
  (id, type, status, pii_ciphertext, pii_key_id, email_index, status_token_hash, form_key, created_at, updated_at)
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
  WHERE (SELECT count(*) FROM requests
    WHERE email_index = ?6 AND status IN ('submitted', 'in_progress', 'ready')) < ?11`;

export const SELECT_ONE = `SELECT ${COLUMNS} FROM requests WHERE id = ?`;

export const SELECT_BY_TOKEN_HASH = `SELECT ${COLUMNS} FROM requests WHERE status_token_hash = ?`;

export const SELECT_BY_FORM_KEY = `SELECT ${COLUMNS} FROM requests WHERE form_key = ?`;

export const COUNT_OPEN_BY_EMAIL = `SELECT count(*) AS total FROM requests
  WHERE email_index = ? AND status IN ('submitted', 'in_progress', 'ready')`;

export const UPDATE_TRANSITION = `UPDATE requests
  SET status = ?1, updated_at = ?2, closed_at = COALESCE(?3, closed_at) WHERE id = ?4`;

export const UPDATE_ERASE_PII = `UPDATE requests
  SET pii_ciphertext = NULL, pii_key_id = NULL, email_index = NULL, pii_erased_at = ?1 WHERE id = ?2`;

export const SELECT_LIST = `SELECT ${COLUMNS} FROM requests
  WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR created_at < ?2)
  ORDER BY created_at DESC LIMIT ?3`;

export const SELECT_INACTIVE = `SELECT ${COLUMNS} FROM requests
  WHERE status IN ('submitted', 'in_progress', 'ready') AND updated_at < ?1
  ORDER BY updated_at LIMIT ?2`;

export const SELECT_CLOSED_BEFORE = `SELECT ${COLUMNS} FROM requests
  WHERE status IN ('collected', 'rejected', 'withdrawn') AND pii_erased_at IS NULL AND closed_at < ?1
  ORDER BY closed_at LIMIT ?2`;

export const SELECT_ERASED_BEFORE = `SELECT ${COLUMNS} FROM requests
  WHERE pii_erased_at IS NOT NULL AND pii_erased_at < ?1
  ORDER BY pii_erased_at LIMIT ?2`;

export const CLOSE_INACTIVE = `UPDATE requests
  SET status = 'rejected', updated_at = ?1, closed_at = ?1
  WHERE id = ?2 AND status IN ('submitted', 'in_progress', 'ready') AND updated_at < ?3`;

export const DELETE_ERASED = "DELETE FROM requests WHERE id = ? AND pii_erased_at IS NOT NULL";

export const WITHDRAW_OPEN = `UPDATE requests SET status = 'withdrawn', updated_at = ?1, closed_at = ?1
  WHERE id = ?2 AND status IN ('submitted', 'in_progress', 'ready')`;

export const WITHDRAW_ERASE = `UPDATE requests
  SET pii_ciphertext = NULL, pii_key_id = NULL, email_index = NULL, pii_erased_at = ?1
  WHERE id = ?2 AND status = 'withdrawn' AND updated_at = ?1 AND pii_erased_at IS NULL`;
