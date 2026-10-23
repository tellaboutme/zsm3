CREATE TABLE files (
  key TEXT PRIMARY KEY CHECK (key GLOB 'd/*' AND length(key) BETWEEN 68 AND 70),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'docx', 'xlsx', 'odt', 'zip', '7z', 'jpg', 'png')),
  bytes INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 104857600),
  created_at TEXT NOT NULL
);
