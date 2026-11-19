CREATE TABLE featured_photos (
  slot TEXT PRIMARY KEY CHECK (slot IN ('home', 'film', 'kandydaci', 'uczniowie', 'rodzice', 'szkola')),
  photo_id TEXT NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX featured_photos_photo ON featured_photos (photo_id);
