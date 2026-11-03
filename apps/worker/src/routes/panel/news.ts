import {
  panelListQuerySchema,
  panelNewsListSchema,
  panelNewsViewSchema,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { requirePanelDeps } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import {
  loadNews,
  NEWS_COUNT_SQL,
  NEWS_LIST_SQL,
  newsItem,
  newsRef,
  newsRowSchema,
} from "./news-data.ts";
import { createNews, publishNews, updateNews } from "./news-writes.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { allRows } from "../../storage/database.ts";

async function listNews(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const query = panelListQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return problemResponse(c, 422);
  }
  const { page, pageSize, status, category, year } = query.data;
  const filters = [status === "all" ? null : status, category ?? null, year ?? null];
  const rows = await allRows(
    deps.db.prepare(NEWS_LIST_SQL).bind(...filters, pageSize, (page - 1) * pageSize),
    newsRowSchema,
  );
  const counted = await allRows(
    deps.db.prepare(NEWS_COUNT_SQL).bind(...filters),
    z.object({ total: z.int() }),
  );
  return c.json(
    panelNewsListSchema.parse({
      items: rows.map(newsItem),
      total: counted.reduce((sum, row) => sum + row.total, 0),
      page,
      pageSize,
    }),
  );
}

async function showNews(c: Context<AppEnv>): Promise<Response> {
  const ref = newsRef(c);
  if (ref === undefined) {
    return problemResponse(c, 422);
  }
  const revision = await requirePanelDeps(c).repos.revisions.current("news", ref.id);
  const row = await loadNews(c, ref.year, ref.slug);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(panelNewsViewSchema.parse({ item: newsItem(row), revision }));
}

export function newsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/news", panelGuard("news.list"), panelJsonOrigin, listNews)
    .get("/news/:year/:slug", panelGuard("news.get"), showNews)
    .post("/news", panelGuard("news.create"), panelJsonOrigin, createNews)
    .put("/news/:year/:slug", panelGuard("news.update"), panelJsonOrigin, updateNews)
    .patch("/news/:year/:slug", panelGuard("news.publish"), panelJsonOrigin, publishNews);
}
