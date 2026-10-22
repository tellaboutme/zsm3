import {
  contentPageSchema,
  type ContentPage,
  type PublicationStatus,
} from "@zsm3/contracts/content";
import { z } from "zod";

import {
  allRows,
  firstRow,
  timestamp,
  type Clock,
  type SqlDatabase,
  type Store,
} from "./database.ts";

export interface PagesRepo {
  save(page: ContentPage, status: PublicationStatus): Promise<void>;
  find(path: string): Promise<ContentPage | undefined>;
  publishedPaths(): Promise<readonly string[]>;
}

const pageRowSchema = z.object({
  path: z.string(),
  kicker: z.string(),
  title: z.string(),
  intro: z.string(),
  sections_json: z.string(),
});

type PageRow = z.infer<typeof pageRowSchema>;

const UPSERT = `INSERT INTO pages
  (path, kicker, title, intro, sections_json, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (path) DO UPDATE SET
    kicker = excluded.kicker, title = excluded.title, intro = excluded.intro,
    sections_json = excluded.sections_json, status = excluded.status,
    updated_at = excluded.updated_at`;

const SELECT_ONE = `SELECT path, kicker, title, intro, sections_json
  FROM pages WHERE path = ? AND status = 'published'`;

const SELECT_PATHS = "SELECT path FROM pages WHERE status = 'published' ORDER BY path";

export function pageFromRow(row: PageRow): ContentPage {
  const sections: unknown = JSON.parse(row.sections_json);
  return contentPageSchema.parse({
    path: row.path,
    kicker: row.kicker,
    title: row.title,
    intro: row.intro,
    sections,
  });
}

async function savePage(
  db: SqlDatabase,
  clock: Clock,
  page: ContentPage,
  status: PublicationStatus,
): Promise<void> {
  const parsed = contentPageSchema.parse(page);
  const now = timestamp(clock);
  await db
    .prepare(UPSERT)
    .bind(
      parsed.path,
      parsed.kicker,
      parsed.title,
      parsed.intro,
      JSON.stringify(parsed.sections),
      status,
      now,
      now,
    )
    .run();
}

export function pagesRepo({ db, clock }: Store): PagesRepo {
  return {
    save: async (page, status) => savePage(db, clock, page, status),
    find: async (path) => {
      const row = await firstRow(db.prepare(SELECT_ONE).bind(path), pageRowSchema);
      return row === undefined ? undefined : pageFromRow(row);
    },
    publishedPaths: async () =>
      (await allRows(db.prepare(SELECT_PATHS), z.object({ path: z.string() }))).map(
        (row) => row.path,
      ),
  };
}
