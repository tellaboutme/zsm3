const COLUMNS =
  "id, kind, request_id, origin, attempts, next_attempt_at, sent_at, failed_at, lease_owner, lease_until";

export const INSERT_OUTBOX = `INSERT INTO email_outbox
  (id, kind, request_id, origin, attempts, next_attempt_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)`;

export const INSERT_OUTBOX_FOR_NEW_REQUEST = `INSERT INTO email_outbox
  (id, kind, request_id, origin, attempts, next_attempt_at)
  SELECT ?1, ?2, ?3, ?4, 0, ?5
  WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?3 AND status_token_hash = ?6)`;

export const INSERT_INACTIVE_REJECTION = `INSERT INTO email_outbox
  (id, kind, request_id, origin, attempts, next_attempt_at)
  SELECT ?1, 'REJECTED_NOTICE', ?2, NULL, 0, ?3
  WHERE EXISTS (SELECT 1 FROM requests WHERE id = ?2 AND status = 'rejected' AND closed_at = ?3)
    AND NOT EXISTS (SELECT 1 FROM email_outbox WHERE request_id = ?2 AND kind = 'REJECTED_NOTICE')`;

export const SELECT_DUE = `SELECT ${COLUMNS} FROM email_outbox
  WHERE sent_at IS NULL AND failed_at IS NULL AND next_attempt_at <= ?1
    AND (lease_until IS NULL OR lease_until <= ?1)
  ORDER BY next_attempt_at LIMIT ?2`;

export const CLAIM_DUE = `UPDATE email_outbox SET lease_owner = ?2, lease_until = ?3
  WHERE id IN (SELECT id FROM email_outbox
    WHERE sent_at IS NULL AND failed_at IS NULL AND next_attempt_at <= ?1
      AND (lease_until IS NULL OR lease_until <= ?1)
    ORDER BY next_attempt_at LIMIT ?4)
  RETURNING ${COLUMNS}`;

export const MARK_SENT = `UPDATE email_outbox SET sent_at = ?1, lease_owner = NULL, lease_until = NULL
  WHERE id = ?2 AND lease_owner = ?3 AND sent_at IS NULL AND failed_at IS NULL RETURNING id`;

export const SELECT_CLAIM = `SELECT id FROM email_outbox
  WHERE id = ?1 AND lease_owner = ?2 AND sent_at IS NULL AND failed_at IS NULL`;

export const SELECT_ACTIVE_CLAIM = `SELECT id FROM email_outbox
  WHERE id = ?1 AND lease_owner = ?2 AND sent_at IS NULL AND failed_at IS NULL
    AND lease_until > ?3 AND EXISTS (SELECT 1 FROM requests
      WHERE id = email_outbox.request_id AND status != 'withdrawn' AND pii_erased_at IS NULL)`;

export const MARK_RETRY = `UPDATE email_outbox SET attempts = attempts + 1, next_attempt_at = ?1, lease_owner = NULL, lease_until = NULL
  WHERE id = ?2 AND lease_owner = ?3 AND sent_at IS NULL AND failed_at IS NULL`;

export const MARK_DEAD = `UPDATE email_outbox
  SET attempts = attempts + 1, next_attempt_at = ?1, failed_at = ?1, lease_owner = NULL, lease_until = NULL
  WHERE id = ?2 AND lease_owner = ?3 AND sent_at IS NULL AND failed_at IS NULL`;

export const INSERT_FAILURE = `INSERT INTO outbox_failures
  (id, message_kind, request_id, error_code, at)
  SELECT ?1, kind, request_id, ?2, ?3 FROM email_outbox
  WHERE id = ?4 AND lease_owner = ?5 AND sent_at IS NULL AND failed_at IS NULL`;

export const DELETE_OUTBOX_FOR_REQUEST = "DELETE FROM email_outbox WHERE request_id = ?";

export const DELETE_FAILURES_FOR_REQUEST = "DELETE FROM outbox_failures WHERE request_id = ?";

export const DELETE_WITHDRAWN_OUTBOX = `DELETE FROM email_outbox WHERE request_id = ?1
  AND EXISTS (SELECT 1 FROM requests WHERE id = ?1 AND status = 'withdrawn' AND updated_at = ?2)`;

export const DELETE_WITHDRAWN_FAILURES = `DELETE FROM outbox_failures WHERE request_id = ?1
  AND EXISTS (SELECT 1 FROM requests WHERE id = ?1 AND status = 'withdrawn' AND updated_at = ?2)`;
