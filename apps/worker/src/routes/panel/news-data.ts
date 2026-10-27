import { publicationStatusSchema, slugSchema } from "@zsm3/contracts/content";
import { schoolYearParamSchema, type PanelNewsItem } from "@zsm3/contracts/panel";
import type { Context } from "hono";
import { z } from "zod";

import { requirePanelDeps } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { firstRow } from "../../storage/database.ts";
import { newsFromRow } from "../../storage/news-repo.ts";

const COLUMNS =
  "slug, published_on, category, title, lead, body_json, cover_caption, cover_credit, status";

export const NEWS_LIST_SQL = `SELECT ${COLUMNS} FROM news
  WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR category = ?2) AND (?3 IS NULL OR year = ?3)
  ORDER BY published_on DESC, slug ASC LIMIT ?4 OFFSET ?5`;

export const NEWS_COUNT_SQL = `SELECT count(*) AS total FROM news
  WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR category = ?2) AND (?3 IS NULL OR year = ?3)`;

export const NEWS_ONE_SQL = `SELECT ${COLUMNS} FROM news WHERE year = ? AND slug = ?`;

export const newsRowSchema = z.object({
  slug: z.string(),
  published_on: z.string(),
  category: z.string(),
  title: z.string(),
  lead: z.string(),
  body_json: z.string(),
  cover_caption: z.string().nullable(),
  cover_credit: z.string().nullable(),
  status: publicationStatusSchema,
});

export type PanelNewsRow = z.infer<typeof newsRowSchema>;

export function newsItem(row: PanelNewsRow): PanelNewsItem {
  return { ...newsFromRow(row), status: row.status };
}

export interface NewsRef {
  readonly year: string;
  readonly slug: string;
  readonly id: string;
}

export function newsRef(c: Context<AppEnv>): NewsRef | undefined {
  const year = schoolYearParamSchema.safeParse(c.req.param("year"));
  const slug = slugSchema.safeParse(c.req.param("slug"));
  if (!year.success || !slug.success) {
    return undefined;
  }
  return { year: String(year.data), slug: slug.data, id: `${String(year.data)}/${slug.data}` };
}

export async function loadNews(
  c: Context<AppEnv>,
  year: string,
  slug: string,
): Promise<PanelNewsRow | undefined> {
  const deps = requirePanelDeps(c);
  return firstRow(deps.db.prepare(NEWS_ONE_SQL).bind(year, slug), newsRowSchema);
}
