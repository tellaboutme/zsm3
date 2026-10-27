CREATE TABLE staff (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 320),
  role TEXT NOT NULL CHECK (role IN ('admin', 'secretariat', 'gallery_editor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  entity TEXT NOT NULL CHECK (length(entity) BETWEEN 1 AND 100),
  entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 300),
  details_json TEXT NOT NULL CHECK (json_valid(details_json))
);

CREATE INDEX audit_log_at ON audit_log (at);

CREATE TABLE content_revisions (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL CHECK (entity IN ('news', 'pages')),
  entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 300),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  actor_email TEXT,
  at TEXT NOT NULL,
  UNIQUE (entity, entity_id, revision)
);

CREATE INDEX content_revisions_entity ON content_revisions (entity, entity_id);
