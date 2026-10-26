INSERT INTO search_documents (doc_id, kind, href, title, body, title_raw, body_raw, published_on)
SELECT 'n:' || id, 'aktualnosc', '/aktualnosci/' || year || '/' || slug,
  replace(replace(lower(title), 'ł', 'l'), 'Ł', 'l'),
  replace(replace(lower(body_text), 'ł', 'l'), 'Ł', 'l'),
  title, body_text, published_on
FROM (
  SELECT news.*,
    category || ' ' || lead || ' ' ||
      coalesce((SELECT group_concat(separator || value, '') FROM (
        SELECT value, CASE WHEN previous_key IS NULL THEN ''
          WHEN key = 'text' AND previous_key = 'text'
          AND rtrim(path, '0123456789]') = rtrim(previous_path, '0123456789]')
          THEN '' ELSE ' ' END AS separator
        FROM (
          SELECT value, key, path, id,
            lag(key) OVER (ORDER BY id) AS previous_key,
            lag(path) OVER (ORDER BY id) AS previous_path
          FROM json_tree(news.body_json)
          WHERE type = 'text' AND (key IN ('text', 'caption', 'title')
            OR (typeof(key) = 'integer' AND (path GLOB '*.header' OR path GLOB '*.rows*')))
        ) ORDER BY id
      )), '') || ' ' || coalesce(cover_caption, '') || ' ' || coalesce(cover_credit, '')
      AS body_text
  FROM news
  WHERE status = 'published'
    AND NOT EXISTS (SELECT 1 FROM search_documents WHERE doc_id = 'n:' || news.id)
);

INSERT INTO search_documents (doc_id, kind, href, title, body, title_raw, body_raw, published_on)
SELECT 'p:' || path, 'strona', path,
  replace(replace(lower(title), 'ł', 'l'), 'Ł', 'l'),
  replace(replace(lower(body_text), 'ł', 'l'), 'Ł', 'l'),
  title, body_text, NULL
FROM (
  SELECT pages.*,
    intro || ' ' || coalesce((SELECT group_concat(separator || value, '') FROM (
      SELECT value, CASE WHEN previous_key IS NULL THEN ''
        WHEN key = 'text' AND previous_key = 'text'
        AND rtrim(path, '0123456789]') = rtrim(previous_path, '0123456789]')
        THEN '' ELSE ' ' END AS separator
      FROM (
        SELECT value, key, path, id,
          lag(key) OVER (ORDER BY id) AS previous_key,
          lag(path) OVER (ORDER BY id) AS previous_path
        FROM json_tree(pages.sections_json)
        WHERE type = 'text' AND (key IN ('title', 'text', 'label', 'value', 'description', 'caption')
          OR (typeof(key) = 'integer' AND (path GLOB '*.header' OR path GLOB '*.rows*')))
      ) ORDER BY id
    )), '') AS body_text
  FROM pages
  WHERE status = 'published'
    AND NOT EXISTS (SELECT 1 FROM search_documents WHERE doc_id = 'p:' || pages.path)
);
