CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  addressee TEXT NOT NULL CHECK (addressee IN ('pedagogue', 'psychologist', 'leadership')),
  status TEXT NOT NULL CHECK (status IN ('received', 'draft', 'published', 'rejected', 'withdrawn')),
  version INTEGER NOT NULL CHECK (version >= 1),
  question_ciphertext BLOB,
  question_key_id TEXT,
  draft_ciphertext BLOB,
  draft_key_id TEXT,
  public_slug TEXT UNIQUE CHECK (public_slug IS NULL OR length(public_slug) = 12),
  published_question TEXT,
  published_answer TEXT,
  published_on TEXT,
  form_key TEXT NOT NULL UNIQUE,
  received_on TEXT NOT NULL CHECK (length(received_on) = 10),
  changed_at TEXT,
  CHECK ((question_ciphertext IS NULL) = (question_key_id IS NULL)),
  CHECK ((draft_ciphertext IS NULL) = (draft_key_id IS NULL)),
  CHECK ((status = 'published') = (published_question IS NOT NULL)),
  CHECK ((published_question IS NULL) = (published_answer IS NULL)),
  CHECK ((published_question IS NULL) = (published_on IS NULL)),
  CHECK (status <> 'published' OR public_slug IS NOT NULL),
  CHECK (status <> 'received' OR question_ciphertext IS NOT NULL),
  CHECK (status NOT IN ('draft', 'published') OR draft_ciphertext IS NOT NULL)
) WITHOUT ROWID;

CREATE INDEX questions_queue ON questions (status, received_on, id);
CREATE INDEX questions_listing ON questions (received_on, id);
CREATE INDEX questions_published ON questions (published_on, id) WHERE status = 'published';

CREATE TABLE staff_next (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 320),
  role TEXT NOT NULL CHECK (role IN ('admin', 'secretariat', 'editor', 'gallery_editor', 'counsellor')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO staff_next (email, role, active, created_at, updated_at)
SELECT email, role, active, created_at, updated_at FROM staff;

DROP TABLE staff;

ALTER TABLE staff_next RENAME TO staff;
