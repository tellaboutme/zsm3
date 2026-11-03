CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  school_year TEXT NOT NULL CHECK (school_year GLOB '[0-9][0-9][0-9][0-9]/[0-9][0-9][0-9][0-9]'),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 120),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (length(description) <= 2000),
  published_at TEXT,
  deleted_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (deleted_at IS NULL OR published_at IS NULL)
);

CREATE UNIQUE INDEX albums_year_slug ON albums (school_year, slug) WHERE deleted_at IS NULL;
CREATE INDEX albums_year ON albums (school_year, deleted_at, published_at);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums (id),
  position INTEGER NOT NULL CHECK (position >= 0),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 1600),
  alt TEXT NOT NULL CHECK (length(alt) BETWEEN 1 AND 300),
  sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  consent_by TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX photos_album ON photos (album_id, deleted_at, position);

CREATE TABLE photo_uploads (
  sha256 TEXT PRIMARY KEY CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  started_at TEXT NOT NULL,
  claimed_at TEXT
);

CREATE INDEX photo_uploads_started ON photo_uploads (started_at);
CREATE INDEX photo_uploads_claimed ON photo_uploads (claimed_at, sha256) WHERE claimed_at IS NOT NULL;
