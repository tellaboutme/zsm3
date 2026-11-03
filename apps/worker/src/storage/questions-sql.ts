export const INSERT_QUESTION = `INSERT INTO questions
  (id, addressee, status, version, question_ciphertext, question_key_id, form_key, received_on)
  VALUES (?1, ?2, 'received', 1, ?3, ?4, ?5, ?6)
  ON CONFLICT (form_key) DO NOTHING`;

const SUMMARY_COLUMNS = "id, addressee, status, version, received_on";

export const LIST_QUESTIONS = `SELECT ${SUMMARY_COLUMNS} FROM questions
  WHERE (?1 IS NULL OR status = ?1)
    AND (?2 IS NULL OR received_on < ?2 OR (received_on = ?2 AND id < ?3))
  ORDER BY received_on DESC, id DESC LIMIT ?4`;

export const SELECT_QUESTION = `SELECT ${SUMMARY_COLUMNS}, question_ciphertext, question_key_id,
  draft_ciphertext, draft_key_id, public_slug, published_on
  FROM questions WHERE id = ?`;

const PUBLIC_COLUMNS = `public_slug, addressee, published_question, published_answer,
  published_on`;

export const LIST_PUBLISHED = `SELECT ${PUBLIC_COLUMNS} FROM questions
  WHERE status = 'published' ORDER BY published_on DESC, id DESC LIMIT ?1 OFFSET ?2`;

export const COUNT_PUBLISHED = "SELECT count(*) AS total FROM questions WHERE status = 'published'";

export const SELECT_PUBLISHED = `SELECT ${PUBLIC_COLUMNS} FROM questions
  WHERE status = 'published' AND public_slug = ?1`;

export const INSERT_AUDIT_FOR_VERSION = `INSERT INTO audit_log
  (id, at, actor_email, action, entity, entity_id, details_json)
  SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
  WHERE EXISTS (SELECT 1 FROM questions WHERE id = ?8 AND version = ?9)`;

export const SAVE_DRAFT = `UPDATE questions SET status = 'draft', draft_ciphertext = ?1,
  draft_key_id = ?2, version = version + 1, changed_at = ?3
  WHERE id = ?4 AND version = ?5 AND status IN ('received', 'draft', 'withdrawn')`;

export const PUBLISH = `UPDATE questions SET status = 'published', published_question = ?1,
  published_answer = ?2, published_on = ?3, public_slug = coalesce(public_slug, ?4),
  question_ciphertext = NULL, question_key_id = NULL, version = version + 1, changed_at = ?5
  WHERE id = ?6 AND version = ?7 AND status = 'draft'`;

export const REJECT = `UPDATE questions SET status = 'rejected', version = version + 1,
  changed_at = ?1
  WHERE id = ?2 AND version = ?3 AND status IN ('received', 'draft', 'withdrawn')`;

export const WITHDRAW = `UPDATE questions SET status = 'withdrawn', published_question = NULL,
  published_answer = NULL, published_on = NULL, version = version + 1, changed_at = ?1
  WHERE id = ?2 AND version = ?3 AND status = 'published'`;

export const DELETE_QUESTION = `DELETE FROM questions
  WHERE id = ?1 AND version = ?2 AND status IN ('received', 'draft', 'rejected', 'withdrawn')`;

export const PRUNE_QUESTIONS = `DELETE FROM questions WHERE id IN (SELECT id FROM questions
  WHERE (status IN ('received', 'draft') AND coalesce(changed_at, received_on) < ?1)
     OR (status IN ('rejected', 'withdrawn') AND coalesce(changed_at, received_on) < ?2)
  LIMIT ?3)`;
