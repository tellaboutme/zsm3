CREATE TABLE featured_photos (
  slot TEXT PRIMARY KEY CHECK (length(slot) BETWEEN 1 AND 40),
  photo_id TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX featured_photos_photo ON featured_photos (photo_id);
