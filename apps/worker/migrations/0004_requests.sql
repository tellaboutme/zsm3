CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('STUDENT_ID_RENEWAL', 'STUDENT_ID_DUPLICATE', 'ENROLLMENT_CERTIFICATE')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'in_progress', 'ready', 'collected', 'rejected', 'withdrawn')),
  pii_ciphertext BLOB,
  pii_key_id TEXT,
  email_index BLOB,
  pii_erased_at TEXT,
  status_token_hash BLOB NOT NULL UNIQUE,
  form_key TEXT NOT NULL UNIQUE,
  staff_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  CHECK ((pii_ciphertext IS NULL) = (pii_erased_at IS NOT NULL))
);
CREATE INDEX idx_requests_status ON requests (status, created_at);
CREATE INDEX idx_requests_email ON requests (email_index, status);
CREATE INDEX idx_requests_closed ON requests (closed_at);

CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('SUBMISSION_CONFIRMATION', 'SECRETARIAT_NOTICE', 'READY_NOTICE', 'REJECTED_NOTICE')),
  request_id TEXT NOT NULL,
  origin TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_until TEXT,
  sent_at TEXT,
  failed_at TEXT
);

CREATE TABLE outbox_failures (
  id TEXT PRIMARY KEY,
  message_kind TEXT NOT NULL,
  request_id TEXT NOT NULL,
  error_code TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key_hash BLOB PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE cron_state (
  job TEXT PRIMARY KEY,
  last_run_date TEXT NOT NULL
);
