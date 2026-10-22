import { newsSchema, type News, type PublicationStatus } from "@zsm3/contracts/content";
import { z } from "zod";

import { allRows, firstRow, timestamp, type SqlDatabase, type Store } from "./database.ts";
import { uuidv7 } from "./ids.ts";

export interface NewsFilter {
  readonly category?: string;
  readonly year?: string;
}

export interface NewsPage {
  readonly limit: number;
  readonly offset: number;
}

export interface NewsRepo {
  save(item: News, status: PublicationStatus): Promise<void>;
  published(filter: NewsFilter, page: NewsPage): Promise<readonly News[]>;
  countPublished(filter: NewsFilter): Promise<number>;
  find(year: string, slug: string): Promise<News | undefined>;
  categories(): Promise<readonly string[]>;
  years(): Promise<readonly string[]>;
}

const newsRowSchema = z.object({
  slug: z.string(),
  published_on: z.string(),
  category: z.string(),
  title: z.string(),
  lead: z.string(),
  body_json: z.string(),
  cover_caption: z.string().nullable(),
  cover_credit: z.string().nullable(),
});

type NewsRow = z.infer<typeof newsRowSchema>;

const INSERT = `INSERT INTO news
  (id, slug, published_on, category, title, lead, body_json, cover_caption, cover_credit, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (year, slug) DO UPDATE SET
    published_on = excluded.published_on, category = excluded.category,
    title = excluded.title, lead = excluded.lead, body_json = excluded.body_json,
    cover_caption = excluded.cover_caption, cover_credit = excluded.cover_credit,
    status = excluded.status, updated_at = excluded.updated_at`;

const SELECT_PUBLISHED = `SELECT slug, published_on, category, title, lead, body_json, cover_caption, cover_credit
  FROM news
  WHERE status = 'published' AND (?1 IS NULL OR category = ?1) AND (?2 IS NULL OR year = ?2)
  ORDER BY published_on DESC, slug ASC LIMIT ?3 OFFSET ?4`;

const COUNT_PUBLISHED = `SELECT count(*) AS total FROM news
  WHERE status = 'published' AND (?1 IS NULL OR category = ?1) AND (?2 IS NULL OR year = ?2)`;

const SELECT_ONE = `SELECT slug, published_on, category, title, lead, body_json, cover_caption, cover_credit
  FROM news WHERE status = 'published' AND year = ? AND slug = ?`;

export function newsFromRow(row: NewsRow): News {
  const body: unknown = JSON.parse(row.body_json);
  return newsSchema.parse({
    slug: row.slug,
    date: row.published_on,
    category: row.category,
    title: row.title,
    lead: row.lead,
    body,
    ...(row.cover_caption === null
      ? {}
      : {
          cover: {
            caption: row.cover_caption,
            ...(row.cover_credit === null ? {} : { credit: row.cover_credit }),
          },
        }),
  });
}

async function saveNews(
  { db, clock, random }: Store,
  item: News,
  status: PublicationStatus,
): Promise<void> {
  const news = newsSchema.parse(item);
  const now = timestamp(clock);
  await db
    .prepare(INSERT)
    .bind(
      uuidv7(clock().getTime(), random),
      news.slug,
      news.date,
      news.category,
      news.title,
      news.lead,
      JSON.stringify(news.body),
      news.cover?.caption ?? null,
      news.cover?.credit ?? null,
      status,
      now,
      now,
    )
    .run();
}

async function publishedNews(
  db: SqlDatabase,
  filter: NewsFilter,
  page: NewsPage,
): Promise<readonly News[]> {
  const statement = db
    .prepare(SELECT_PUBLISHED)
    .bind(filter.category ?? null, filter.year ?? null, page.limit, page.offset);
  return (await allRows(statement, newsRowSchema)).map(newsFromRow);
}

async function countNews(db: SqlDatabase, filter: NewsFilter): Promise<number> {
  const statement = db.prepare(COUNT_PUBLISHED).bind(filter.category ?? null, filter.year ?? null);
  const rows = await allRows(statement, z.object({ total: z.number() }));
  return rows.reduce((sum, row) => sum + row.total, 0);
}

async function findNews(db: SqlDatabase, year: string, slug: string): Promise<News | undefined> {
  const row = await firstRow(db.prepare(SELECT_ONE).bind(year, slug), newsRowSchema);
  return row === undefined ? undefined : newsFromRow(row);
}

async function distinctValues(db: SqlDatabase, query: string): Promise<readonly string[]> {
  const rows = await allRows(db.prepare(query), z.object({ value: z.string() }));
  return rows.map((row) => row.value);
}

export function newsRepo(store: Store): NewsRepo {
  const { db } = store;
  return {
    save: async (item, status) => saveNews(store, item, status),
    published: async (filter, page) => publishedNews(db, filter, page),
    countPublished: async (filter) => countNews(db, filter),
    find: async (year, slug) => findNews(db, year, slug),
    categories: async () =>
      distinctValues(
        db,
        "SELECT DISTINCT category AS value FROM news WHERE status = 'published' ORDER BY category",
      ),
    years: async () =>
      distinctValues(
        db,
        "SELECT DISTINCT year AS value FROM news WHERE status = 'published' ORDER BY year DESC",
      ),
  };
}
