CREATE TABLE short_link_failures (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  attempted_at INTEGER NOT NULL CHECK (attempted_at > 0)
);
CREATE INDEX idx_short_link_failures_code ON short_link_failures (code, attempted_at);
CREATE INDEX idx_short_link_failures_age ON short_link_failures (attempted_at);
