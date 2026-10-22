PRAGMA foreign_keys = ON;

CREATE TABLE news (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  published_on TEXT NOT NULL CHECK (published_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  year TEXT GENERATED ALWAYS AS (substr(published_on, 1, 4)) STORED,
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 80),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  lead TEXT NOT NULL CHECK (length(lead) BETWEEN 1 AND 500),
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  cover_caption TEXT CHECK (cover_caption IS NULL OR length(cover_caption) BETWEEN 1 AND 300),
  cover_credit TEXT CHECK (cover_credit IS NULL OR length(cover_credit) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (year, slug)
);

CREATE INDEX news_published ON news (status, published_on DESC);
CREATE INDEX news_category ON news (status, category, published_on DESC);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  starts_on TEXT NOT NULL CHECK (starts_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  ends_on TEXT CHECK (ends_on IS NULL OR ends_on > starts_on),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  audience TEXT NOT NULL CHECK (audience IN ('Wszyscy', 'Uczniowie', 'Rodzice')),
  kind TEXT NOT NULL CHECK (
    kind IN ('rok-szkolny', 'przerwa', 'wolne', 'zebranie', 'uroczystosc', 'oceny', 'egzamin', 'praktyki')
  ),
  note TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 300),
  key_date INTEGER NOT NULL DEFAULT 0 CHECK (key_date IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX events_starts ON events (starts_on);

CREATE TABLE pages (
  path TEXT PRIMARY KEY CHECK (path GLOB '/[a-z]*' AND path NOT GLOB '*[^a-z0-9/-]*'),
  kicker TEXT NOT NULL CHECK (length(kicker) BETWEEN 1 AND 120),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  intro TEXT NOT NULL CHECK (length(intro) BETWEEN 1 AND 600),
  sections_json TEXT NOT NULL CHECK (json_valid(sections_json)),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE redirects (
  from_path TEXT PRIMARY KEY CHECK (from_path GLOB '/*'),
  to_path TEXT NOT NULL CHECK (to_path GLOB '/*' AND to_path <> from_path),
  created_at TEXT NOT NULL
);
