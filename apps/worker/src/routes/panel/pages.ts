import { publicationStatusSchema, sitePathSchema } from "@zsm3/contracts/content";
import {
  panelMutationSchema,
  panelPageListSchema,
  panelPageViewSchema,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { pageSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { allRows, firstRow, type SqlStatement } from "../../storage/database.ts";
import { pageFromRow } from "../../storage/pages-repo.ts";

const PAGE_ONE =
  "SELECT path, kicker, title, intro, sections_json, status FROM pages WHERE path = ?";
const PAGE_LIST = "SELECT path, status, title FROM pages ORDER BY path";

const pageRowSchema = z.object({
  path: z.string(),
  kicker: z.string(),
  title: z.string(),
  intro: z.string(),
  sections_json: z.string(),
  status: publicationStatusSchema,
});

const pageListRowSchema = z.object({
  path: sitePathSchema,
  status: publicationStatusSchema,
  title: z.string(),
});

const PAGES_PREFIX = "/api/panel/pages";

function routePath(c: Context<AppEnv>): string | undefined {
  const candidate = c.req.path.slice(PAGES_PREFIX.length);
  return sitePathSchema.safeParse(candidate).success ? candidate : undefined;
}

async function listPages(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const rows = await allRows(deps.db.prepare(PAGE_LIST), pageListRowSchema);
  return c.json(panelPageListSchema.parse({ items: rows }));
}

async function showPage(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const path = routePath(c);
  if (path === undefined) {
    return problemResponse(c, 422);
  }
  const row = await firstRow(deps.db.prepare(PAGE_ONE).bind(path), pageRowSchema);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(panelPageViewSchema.parse({ item: { ...pageFromRow(row), status: row.status } }));
}

async function savePage(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const path = routePath(c);
  if (path === undefined) {
    return problemResponse(c, 422);
  }
  const save = pageSave(await parseJsonBody(c, panelMutationSchema));
  if (save?.page.path !== path) {
    return problemResponse(c, 422);
  }
  const row = await firstRow(deps.db.prepare(PAGE_ONE).bind(path), pageRowSchema);
  const writes: SqlStatement[] = [];
  let fields: readonly string[];
  if (row === undefined) {
    fields = createdFields(save.page);
  } else {
    const previous = pageFromRow(row);
    writes.push(
      deps.repos.revisions.statement(
        "pages",
        path,
        JSON.stringify({ ...previous, status: row.status }),
        session.email,
      ),
    );
    fields = changedFields(previous, save.page);
  }
  writes.push(...deps.repos.pages.saveStatements(save.page, save.status));
  writes.push(
    deps.repos.audit.statement(
      auditEntry({ session, action: "pages.save", entity: "pages", entityId: path, fields }),
    ),
  );
  await atomicWrite(deps, writes);
  return c.json({ ok: true });
}

export function pagesRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/pages", panelGuard("pages.list"), async (c) => listPages(c))
    .get("/pages/:path{.+}", panelGuard("pages.get"), async (c) => showPage(c))
    .put("/pages/:path{.+}", panelGuard("pages.save"), panelJsonOrigin, async (c) => savePage(c));
}
