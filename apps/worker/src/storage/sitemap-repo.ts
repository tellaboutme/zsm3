import { isoDateSchema, newsPath, sitePathSchema, slugSchema } from "@zsm3/contracts/content";
import { GALLERY_PATH, galleryAlbumPath, galleryYearPath } from "@zsm3/contracts/gallery-public";
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

const albumRowSchema = z.object({
  school_year: z.string(),
  slug: slugSchema,
  updated_at: z.iso.datetime(),
});

const SELECT_ALBUMS = `SELECT school_year, slug, updated_at FROM albums
  WHERE published_at IS NOT NULL AND deleted_at IS NULL ORDER BY updated_at DESC, id`;

function galleryEntries(rows: readonly z.infer<typeof albumRowSchema>[]): readonly SitemapEntry[] {
  const entries = new Map<string, string>();
  for (const row of rows) {
    const album = { schoolYear: row.school_year, slug: row.slug };
    for (const path of [GALLERY_PATH, galleryYearPath(row.school_year), galleryAlbumPath(album)]) {
      if (!entries.has(path)) {
        entries.set(path, row.updated_at);
      }
    }
  }
  return [...entries].map(([path, lastmod]) => ({ path, lastmod }));
}

export function sitemapRepo({ db }: Store): SitemapRepo {
  return {
    published: async () => {
      const [pages, news, albums] = await Promise.all([
        allRows(db.prepare(SELECT_PAGES), pageRowSchema),
        allRows(db.prepare(SELECT_NEWS), newsRowSchema),
        allRows(db.prepare(SELECT_ALBUMS), albumRowSchema),
      ]);
      return [
        ...pages.map((row) => ({ path: row.path, lastmod: row.updated_at })),
        ...news.map((row) => ({
          path: newsPath({ date: row.published_on, slug: row.slug }),
          lastmod: row.updated_at,
        })),
        ...galleryEntries(albums),
      ];
    },
  };
}
