CREATE TABLE short_links (
  code TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  password_salt BLOB,
  password_hash BLOB,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  CHECK ((password_hash IS NULL) = (password_salt IS NULL)),
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_short_links_expires ON short_links (expires_at);
CREATE INDEX idx_short_links_author ON short_links (created_by, created_at);
