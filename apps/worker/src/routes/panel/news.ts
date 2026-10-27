import {
  panelListQuerySchema,
  panelMutationSchema,
  panelNewsListSchema,
  panelNewsViewSchema,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { newsMutation, newsPublish } from "./mutations.ts";
import {
  loadNews,
  NEWS_COUNT_SQL,
  NEWS_LIST_SQL,
  newsItem,
  newsRef,
  newsRowSchema,
} from "./news-data.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { allRows } from "../../storage/database.ts";
import { newsFromRow } from "../../storage/news-repo.ts";

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
  const row = await loadNews(c, ref.year, ref.slug);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(panelNewsViewSchema.parse({ item: newsItem(row) }));
}

async function createNews(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const item = newsMutation(await parseJsonBody(c, panelMutationSchema));
  const year = item?.date.slice(0, 4);
  if (item === undefined || year === undefined) {
    return problemResponse(c, 422);
  }
  if ((await loadNews(c, year, item.slug)) !== undefined) {
    return problemResponse(c, 422);
  }
  await atomicWrite(deps, [
    ...(await deps.repos.news.saveStatements(item, "draft")),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "news.create",
        entity: "news",
        entityId: `${year}/${item.slug}`,
        fields: createdFields(item),
      }),
    ),
  ]);
  return c.json({ ok: true }, 201);
}

async function updateNews(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const ref = newsRef(c);
  if (ref === undefined) {
    return problemResponse(c, 422);
  }
  const item = newsMutation(await parseJsonBody(c, panelMutationSchema));
  if (item === undefined) {
    return problemResponse(c, 422);
  }
  if (item.date.slice(0, 4) !== ref.year || item.slug !== ref.slug) {
    return problemResponse(c, 422);
  }
  const row = await loadNews(c, ref.year, ref.slug);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  const previous = newsFromRow(row);
  await atomicWrite(deps, [
    deps.repos.revisions.statement(
      "news",
      ref.id,
      JSON.stringify({ ...previous, status: row.status }),
      session.email,
    ),
    ...(await deps.repos.news.saveStatements(item, row.status)),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "news.update",
        entity: "news",
        entityId: ref.id,
        fields: changedFields(previous, item),
      }),
    ),
  ]);
  return c.json({ ok: true });
}

async function publishNews(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const ref = newsRef(c);
  if (ref === undefined) {
    return problemResponse(c, 422);
  }
  const action = newsPublish(await parseJsonBody(c, panelMutationSchema));
  if (action === undefined) {
    return problemResponse(c, 422);
  }
  const row = await loadNews(c, ref.year, ref.slug);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  const status = action === "publish" ? "published" : "draft";
  if (row.status === status) {
    return problemResponse(c, 422, "Publication Status Unchanged");
  }
  const previous = newsFromRow(row);
  await atomicWrite(deps, [
    deps.repos.revisions.statement(
      "news",
      ref.id,
      JSON.stringify({ ...previous, status: row.status }),
      session.email,
    ),
    ...(await deps.repos.news.saveStatements(previous, status)),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: `news.${action}`,
        entity: "news",
        entityId: ref.id,
        fields: ["status"],
      }),
    ),
  ]);
  return c.json({ ok: true });
}

export function newsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/news", panelGuard("news.list"), panelJsonOrigin, listNews)
    .get("/news/:year/:slug", panelGuard("news.get"), showNews)
    .post("/news", panelGuard("news.create"), panelJsonOrigin, createNews)
    .put("/news/:year/:slug", panelGuard("news.update"), panelJsonOrigin, updateNews)
    .patch("/news/:year/:slug", panelGuard("news.publish"), panelJsonOrigin, publishNews);
}
