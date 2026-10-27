CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'important', 'urgent')),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 300),
  link_label TEXT CHECK (link_label IS NULL OR length(link_label) BETWEEN 1 AND 80),
  link_href TEXT CHECK (link_href IS NULL OR length(link_href) BETWEEN 1 AND 500),
  starts_on TEXT NOT NULL CHECK (starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  ends_on TEXT NOT NULL CHECK (ends_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND ends_on >= starts_on),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((link_label IS NULL) = (link_href IS NULL))
);

CREATE INDEX announcements_window ON announcements (ends_on, starts_on);
