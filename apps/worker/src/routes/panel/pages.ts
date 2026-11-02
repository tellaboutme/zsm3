import { publicationStatusSchema, sitePathSchema } from "@zsm3/contracts/content";
import {
  panelMutationSchema,
  panelPageListSchema,
  panelPageViewSchema,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { announce } from "./announce.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { pageSave, type PageSave } from "./mutations.ts";
import { atRevision, committed, contentChanged } from "./versions.ts";
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

type PageRow = z.infer<typeof pageRowSchema>;

const PAGES_PREFIX = "/api/panel/pages";

async function loadPage(c: Context<AppEnv>, path: string): Promise<PageRow | undefined> {
  return firstRow(requirePanelDeps(c).db.prepare(PAGE_ONE).bind(path), pageRowSchema);
}

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
  const revision = await deps.repos.revisions.current("pages", path);
  const row = await loadPage(c, path);
  if (row === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(
    panelPageViewSchema.parse({ item: { ...pageFromRow(row), status: row.status }, revision }),
  );
}

interface PageWrite {
  readonly statements: readonly SqlStatement[];
  readonly fields: readonly string[];
  readonly unchanged: () => Promise<boolean>;
  readonly revision: number;
}

function pageAudit(c: Context<AppEnv>, path: string, fields: readonly string[]): SqlStatement {
  const session = requirePanelSession(c);
  return requirePanelDeps(c).repos.audit.statement(
    auditEntry({ session, action: "pages.save", entity: "pages", entityId: path, fields }),
  );
}

function createPage(c: Context<AppEnv>, save: PageSave): PageWrite {
  const fields = createdFields(save.page);
  return {
    statements: [
      ...requirePanelDeps(c).repos.pages.createStatements(save.page, save.status),
      pageAudit(c, save.page.path, fields),
    ],
    fields,
    unchanged: async () => (await loadPage(c, save.page.path)) === undefined,
    revision: 0,
  };
}

function updatePage(c: Context<AppEnv>, save: PageSave, row: PageRow, expected: number): PageWrite {
  const deps = requirePanelDeps(c);
  const { path } = save.page;
  const previous = pageFromRow(row);
  const fields = changedFields(previous, save.page);
  const revision = deps.repos.revisions.expectedStatement({
    entity: "pages",
    entityId: path,
    dataJson: JSON.stringify({ ...previous, status: row.status }),
    actorEmail: requirePanelSession(c).email,
    expected,
  });
  return {
    statements: [
      revision,
      ...deps.repos.pages.saveStatements(save.page, save.status),
      pageAudit(c, path, fields),
    ],
    fields,
    unchanged: async () => atRevision(deps, "pages", path, expected),
    revision: expected + 1,
  };
}

async function plannedWrite(
  c: Context<AppEnv>,
  save: PageSave,
  row: PageRow | undefined,
): Promise<PageWrite | undefined> {
  const expected = save.expectedRevision;
  if (row === undefined || expected === null) {
    return row === undefined && expected === null ? createPage(c, save) : undefined;
  }
  const current = await atRevision(requirePanelDeps(c), "pages", save.page.path, expected);
  return current ? updatePage(c, save, row, expected) : undefined;
}

async function savePage(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const path = routePath(c);
  const save = pageSave(await parseJsonBody(c, panelMutationSchema));
  if (path === undefined || save?.page.path !== path) {
    return problemResponse(c, 422);
  }
  const row = await loadPage(c, path);
  const write = await plannedWrite(c, save, row);
  if (write === undefined || !(await committed(deps, write.statements, write.unchanged))) {
    return contentChanged(c);
  }
  const edited = write.fields.length > 0;
  await announce(deps, { before: row?.status, after: save.status, edited }, path);
  return c.json({ ok: true, revision: write.revision });
}

export function pagesRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/pages", panelGuard("pages.list"), async (c) => listPages(c))
    .get("/pages/:path{.+}", panelGuard("pages.get"), async (c) => showPage(c))
    .put("/pages/:path{.+}", panelGuard("pages.save"), panelJsonOrigin, async (c) => savePage(c));
}
