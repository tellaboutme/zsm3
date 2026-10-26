import {
  contentPageSchema,
  type ContentBlock,
  type ContentPage,
  type PublicationStatus,
} from "@zsm3/contracts/content";
import { plainText } from "@zsm3/contracts/rich-text";
import type { SearchDocument } from "@zsm3/contracts/search";
import { z } from "zod";

import {
  allRows,
  firstRow,
  timestamp,
  type Clock,
  type SqlDatabase,
  type Store,
} from "./database.ts";
import { insertDocument, removeDocument } from "./search-sql.ts";

export interface PagesRepo {
  save(page: ContentPage, status: PublicationStatus): Promise<void>;
  find(path: string): Promise<ContentPage | undefined>;
  publishedPaths(): Promise<readonly string[]>;
  published(): Promise<readonly ContentPage[]>;
}

export const pageRowSchema = z.object({
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

const SELECT_PUBLISHED = `SELECT path, kicker, title, intro, sections_json
  FROM pages WHERE status = 'published' ORDER BY path LIMIT 500`;

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

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case "rich-text":
      return plainText(block.document);
    case "facts":
      return [block.label, ...block.facts.map((fact) => `${fact.value} ${fact.label}`)].join(" ");
    case "timeline":
      return block.items.map((item) => `${item.label} ${item.title} ${item.text}`).join(" ");
    case "callout":
      return `${block.title} ${block.text}`;
    case "files":
      return [
        block.label,
        ...block.files.map((file) => [file.title, file.description ?? ""].join(" ").trim()),
      ].join(" ");
  }
}

export function pageDocument(page: ContentPage): SearchDocument {
  return {
    docId: `p:${page.path}`,
    kind: "strona",
    href: page.path,
    title: page.title,
    body: [
      page.intro,
      ...page.sections.map((section) =>
        [section.title, ...section.blocks.map(blockText)].join(" "),
      ),
    ].join(" "),
    publishedOn: null,
  };
}

async function savePage(
  db: SqlDatabase,
  clock: Clock,
  page: ContentPage,
  status: PublicationStatus,
): Promise<void> {
  const parsed = contentPageSchema.parse(page);
  const now = timestamp(clock);
  const doc = pageDocument(parsed);
  await db.batch([
    db
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
      ),
    removeDocument(db, doc.docId),
    ...(status === "published" ? [insertDocument(db, doc)] : []),
  ]);
}

export function pagesRepo({ db, clock }: Store): PagesRepo {
  return {
    save: async (page, status) => savePage(db, clock, page, status),
    find: async (path) => {
      const row = await firstRow(db.prepare(SELECT_ONE).bind(path), pageRowSchema);
      return row === undefined ? undefined : pageFromRow(row);
    },
    published: async () =>
      (await allRows(db.prepare(SELECT_PUBLISHED), pageRowSchema)).map(pageFromRow),
    publishedPaths: async () =>
      (await allRows(db.prepare(SELECT_PATHS), z.object({ path: z.string() }))).map(
        (row) => row.path,
      ),
  };
}
