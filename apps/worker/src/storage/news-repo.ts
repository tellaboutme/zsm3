import { newsSchema, type News, type PublicationStatus } from "@zsm3/contracts/content";
import { plainText } from "@zsm3/contracts/rich-text";
import type { SearchDocument } from "@zsm3/contracts/search";
import { z } from "zod";

import {
  allRows,
  firstRow,
  timestamp,
  type SqlDatabase,
  type SqlStatement,
  type Store,
} from "./database.ts";
import { uuidv7 } from "./ids.ts";
import {
  COUNT_PUBLISHED,
  SELECT_CATEGORIES,
  SELECT_NEWER,
  SELECT_OLDER,
  SELECT_ONE,
  SELECT_PUBLISHED,
  SELECT_RELATED,
  SELECT_YEARS,
  UPSERT_NEWS,
} from "./news-sql.ts";
import { insertDocument, removeDocument } from "./search-sql.ts";

export interface NewsFilter {
  readonly category?: string;
  readonly year?: string;
}

export interface NewsPage {
  readonly limit: number;
  readonly offset: number;
}

export interface Neighbours {
  readonly newer: News | undefined;
  readonly older: News | undefined;
}

export interface NewsRepo {
  save(item: News, status: PublicationStatus): Promise<void>;
  saveStatements(item: News, status: PublicationStatus): Promise<readonly SqlStatement[]>;
  published(filter: NewsFilter, page: NewsPage): Promise<readonly News[]>;
  countPublished(filter: NewsFilter): Promise<number>;
  find(year: string, slug: string): Promise<News | undefined>;
  neighbours(item: News): Promise<Neighbours>;
  related(item: News, limit: number): Promise<readonly News[]>;
  categories(): Promise<readonly string[]>;
  years(): Promise<readonly string[]>;
}

export const newsRowSchema = z.object({
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

export function newsDocument(id: string, item: News): SearchDocument {
  return {
    docId: `n:${id}`,
    kind: "aktualnosc",
    href: `/aktualnosci/${item.date.slice(0, 4)}/${item.slug}`,
    title: item.title,
    body: [
      item.category,
      item.lead,
      plainText(item.body),
      item.cover?.caption ?? "",
      item.cover?.credit ?? "",
    ].join(" "),
    publishedOn: item.date,
  };
}

const SELECT_ID = "SELECT id FROM news WHERE year = ? AND slug = ?";

async function saveNews(
  { db, clock, random }: Store,
  item: News,
  status: PublicationStatus,
): Promise<readonly SqlStatement[]> {
  const news = newsSchema.parse(item);
  const now = timestamp(clock);
  const existing = await firstRow(
    db.prepare(SELECT_ID).bind(news.date.slice(0, 4), news.slug),
    z.object({ id: z.string() }),
  );
  const id = existing?.id ?? uuidv7(clock().getTime(), random);
  const doc = newsDocument(id, news);
  return [
    db
      .prepare(UPSERT_NEWS)
      .bind(
        id,
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
      ),
    removeDocument(db, doc.docId),
    ...(status === "published" ? [insertDocument(db, doc)] : []),
  ];
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

async function oneNews(statement: SqlStatement): Promise<News | undefined> {
  const row = await firstRow(statement, newsRowSchema);
  return row === undefined ? undefined : newsFromRow(row);
}

async function neighbourNews(db: SqlDatabase, item: News): Promise<Neighbours> {
  const [newer, older] = await Promise.all([
    oneNews(db.prepare(SELECT_NEWER).bind(item.date, item.slug)),
    oneNews(db.prepare(SELECT_OLDER).bind(item.date, item.slug)),
  ]);
  return { newer, older };
}

async function relatedNews(db: SqlDatabase, item: News, limit: number): Promise<readonly News[]> {
  const statement = db.prepare(SELECT_RELATED).bind(item.date, item.slug, item.category, limit);
  return (await allRows(statement, newsRowSchema)).map(newsFromRow);
}

async function distinctValues(db: SqlDatabase, query: string): Promise<readonly string[]> {
  const rows = await allRows(db.prepare(query), z.object({ value: z.string() }));
  return rows.map((row) => row.value);
}

export function newsRepo(store: Store): NewsRepo {
  const { db } = store;
  return {
    save: async (item, status) => {
      await db.batch([...(await saveNews(store, item, status))]);
    },
    saveStatements: async (item, status) => saveNews(store, item, status),
    published: async (filter, page) => publishedNews(db, filter, page),
    countPublished: async (filter) => countNews(db, filter),
    find: async (year, slug) => oneNews(db.prepare(SELECT_ONE).bind(year, slug)),
    neighbours: async (item) => neighbourNews(db, item),
    related: async (item, limit) => relatedNews(db, item, limit),
    categories: async () => distinctValues(db, SELECT_CATEGORIES),
    years: async () => distinctValues(db, SELECT_YEARS),
  };
}
