import { isoDateSchema, sitePathSchema, slugSchema } from "@zsm3/contracts/content";
import { z } from "zod";

import { allRows, type Store } from "./database.ts";

export interface SitemapEntry {
  readonly path: string;
  readonly lastmod: string;
}

export interface SitemapRepo {
  published(): Promise<readonly SitemapEntry[]>;
}

const pageRowSchema = z.object({ path: sitePathSchema, updated_at: z.iso.datetime() });

const newsRowSchema = z.object({
  slug: slugSchema,
  published_on: isoDateSchema,
  updated_at: z.iso.datetime(),
});

const SELECT_PAGES = "SELECT path, updated_at FROM pages WHERE status = 'published' ORDER BY path";

const SELECT_NEWS = `SELECT slug, published_on, updated_at FROM news
  WHERE status = 'published' ORDER BY published_on DESC, slug`;

export function sitemapRepo({ db }: Store): SitemapRepo {
  return {
    published: async () => {
      const [pages, news] = await Promise.all([
        allRows(db.prepare(SELECT_PAGES), pageRowSchema),
        allRows(db.prepare(SELECT_NEWS), newsRowSchema),
      ]);
      return [
        ...pages.map((row) => ({ path: row.path, lastmod: row.updated_at })),
        ...news.map((row) => ({
          path: `/aktualnosci/${row.published_on.slice(0, 4)}/${row.slug}`,
          lastmod: row.updated_at,
        })),
      ];
    },
  };
}
