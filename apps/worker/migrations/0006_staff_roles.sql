CREATE TABLE staff_next (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 320),
  role TEXT NOT NULL CHECK (role IN ('admin', 'secretariat', 'editor', 'gallery_editor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO staff_next (email, role, active, created_at, updated_at)
SELECT email, role, active, created_at, updated_at FROM staff;

DROP TABLE staff;

ALTER TABLE staff_next RENAME TO staff;
