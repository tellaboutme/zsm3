const COLUMNS = "slug, published_on, category, title, lead, body_json, cover_caption, cover_credit";

export const UPSERT_NEWS = `INSERT INTO news
  (id, slug, published_on, category, title, lead, body_json, cover_caption, cover_credit, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (year, slug) DO UPDATE SET
    published_on = excluded.published_on, category = excluded.category,
    title = excluded.title, lead = excluded.lead, body_json = excluded.body_json,
    cover_caption = excluded.cover_caption, cover_credit = excluded.cover_credit,
    status = excluded.status, updated_at = excluded.updated_at`;

export const SELECT_PUBLISHED = `SELECT ${COLUMNS} FROM news
  WHERE status = 'published' AND (?1 IS NULL OR category = ?1) AND (?2 IS NULL OR year = ?2)
  ORDER BY published_on DESC, slug ASC LIMIT ?3 OFFSET ?4`;

export const COUNT_PUBLISHED = `SELECT count(*) AS total FROM news
  WHERE status = 'published' AND (?1 IS NULL OR category = ?1) AND (?2 IS NULL OR year = ?2)`;

export const SELECT_ONE = `SELECT ${COLUMNS} FROM news
  WHERE status = 'published' AND year = ? AND slug = ?`;

export const SELECT_NEWER = `SELECT ${COLUMNS} FROM news
  WHERE status = 'published' AND (published_on > ?1 OR (published_on = ?1 AND slug < ?2))
  ORDER BY published_on ASC, slug DESC LIMIT 1`;

export const SELECT_OLDER = `SELECT ${COLUMNS} FROM news
  WHERE status = 'published' AND (published_on < ?1 OR (published_on = ?1 AND slug > ?2))
  ORDER BY published_on DESC, slug ASC LIMIT 1`;

export const SELECT_RELATED = `SELECT ${COLUMNS} FROM news
  WHERE status = 'published' AND NOT (published_on = ?1 AND slug = ?2)
  ORDER BY category = ?3 DESC, published_on DESC, slug ASC LIMIT ?4`;

export const SELECT_CATEGORIES =
  "SELECT DISTINCT category AS value FROM news WHERE status = 'published' ORDER BY category";

export const SELECT_YEARS =
  "SELECT DISTINCT year AS value FROM news WHERE status = 'published' ORDER BY year DESC";
