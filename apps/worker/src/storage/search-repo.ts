import { searchKindSchema, type SearchDocument } from "@zsm3/contracts/search";
import { z } from "zod";

import { allRows, type SqlDatabase, type Store } from "./database.ts";
import { newsDocument, newsFromRow, newsRowSchema } from "./news-repo.ts";
import { pageDocument, pageFromRow, pageRowSchema } from "./pages-repo.ts";
import {
  CLEAR_DOCS,
  insertDocument,
  MATCH_DOCS,
  removeDocument,
  SELECT_NEWS_SOURCES,
  SELECT_PAGE_SOURCES,
} from "./search-sql.ts";

export type SearchTerms = readonly (readonly string[])[];

const SAFE_TERM = /^[a-z0-9]+$/u;

const resultRowSchema = z.object({
  doc_id: z.string(),
  kind: searchKindSchema,
  href: z.string(),
  title_raw: z.string(),
  body_raw: z.string(),
  published_on: z.string().nullable(),
});

const newsSourceSchema = newsRowSchema.extend({ id: z.string() });

type ResultRow = z.infer<typeof resultRowSchema>;

function group(terms: readonly string[]): string {
  const safe = [...new Set(terms)].filter((term) => SAFE_TERM.test(term));
  return safe.length === 0
    ? ""
    : `{title body}: (${safe.map((term) => `"${term}"*`).join(" OR ")})`;
}

export function matchQuery(terms: SearchTerms): string | undefined {
  const groups = terms.map(group).filter((part) => part.length > 0);
  return groups.length === 0 ? undefined : groups.join(" AND ");
}

function document(row: ResultRow): SearchDocument {
  return {
    docId: row.doc_id,
    kind: row.kind,
    href: row.href,
    title: row.title_raw,
    body: row.body_raw,
    publishedOn: row.published_on,
  };
}

async function findDocuments(
  db: SqlDatabase,
  terms: SearchTerms,
  limit: number,
): Promise<readonly SearchDocument[]> {
  const query = matchQuery(terms);
  if (query === undefined) {
    return [];
  }
  const rows = await allRows(db.prepare(MATCH_DOCS).bind(query, limit), resultRowSchema);
  return rows.map(document);
}

async function rebuild(db: SqlDatabase): Promise<void> {
  const [news, pages] = await Promise.all([
    allRows(db.prepare(SELECT_NEWS_SOURCES), newsSourceSchema),
    allRows(db.prepare(SELECT_PAGE_SOURCES), pageRowSchema),
  ]);
  const documents = [
    ...news.map((row) => newsDocument(row.id, newsFromRow(row))),
    ...pages.map((row) => pageDocument(pageFromRow(row))),
  ];
  await db.batch([db.prepare(CLEAR_DOCS), ...documents.map((doc) => insertDocument(db, doc))]);
}

export interface SearchRepo {
  index(doc: SearchDocument): Promise<void>;
  remove(docId: string): Promise<void>;
  search(terms: SearchTerms, limit: number): Promise<readonly SearchDocument[]>;
}

export function searchRepo({ db }: Store): SearchRepo {
  return {
    index: async (doc) => {
      await db.batch([removeDocument(db, doc.docId), insertDocument(db, doc)]);
    },
    remove: async (docId) => {
      await removeDocument(db, docId).run();
    },
    search: async (terms, limit) => findDocuments(db, terms, limit),
  };
}

export async function reindex(store: Store): Promise<void> {
  await rebuild(store.db);
}
