import { fold } from "@zsm3/contracts/fold";
import type { SearchDocument } from "@zsm3/contracts/search";

import type { SqlDatabase, SqlStatement } from "./database.ts";

export const DELETE_DOC = "DELETE FROM search_documents WHERE doc_id = ?";

export const INSERT_DOC = `INSERT INTO search_documents
  (doc_id, kind, href, title, body, title_raw, body_raw, published_on)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export const CLEAR_DOCS = "DELETE FROM search_documents";

export const SELECT_NEWS_SOURCES = `SELECT id, slug, published_on, category, title, lead, body_json, cover_caption, cover_credit
  FROM news WHERE status = 'published' ORDER BY published_on, slug`;

export const SELECT_PAGE_SOURCES = `SELECT path, kicker, title, intro, sections_json
  FROM pages WHERE status = 'published' ORDER BY path`;

export const MATCH_DOCS = `SELECT doc_id, kind, href, title_raw, body_raw, published_on
  FROM search_documents WHERE search_documents MATCH ?1
  ORDER BY bm25(search_documents, 0, 0, 0, 3, 1, 0, 0, 0), published_on DESC, doc_id LIMIT ?2`;

export function removeDocument(db: SqlDatabase, docId: string): SqlStatement {
  return db.prepare(DELETE_DOC).bind(docId);
}

export function insertDocument(db: SqlDatabase, doc: SearchDocument): SqlStatement {
  return db
    .prepare(INSERT_DOC)
    .bind(
      doc.docId,
      doc.kind,
      doc.href,
      fold(doc.title),
      fold(doc.body),
      doc.title,
      doc.body,
      doc.publishedOn,
    );
}
