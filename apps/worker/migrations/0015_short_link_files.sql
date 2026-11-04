CREATE TABLE short_link_files (
  object_key TEXT PRIMARY KEY CHECK (object_key GLOB 's/*'),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  removed_at TEXT
);
CREATE INDEX idx_short_link_files_pending ON short_link_files (removed_at, created_at);
