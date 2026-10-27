import {
  panelMutationSchema,
  panelRedirectFromSchema,
  panelRedirectListSchema,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { redirectSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { allRows } from "../../storage/database.ts";
import { normalisePath } from "../../storage/redirects-repo.ts";

const REDIRECTS_LIST = "SELECT from_path, to_path FROM redirects ORDER BY from_path";

const redirectRowSchema = z.object({ from_path: z.string(), to_path: z.string() });

const REDIRECTS_PREFIX = "/api/panel/redirects";

function routePath(c: Context<AppEnv>): string | undefined {
  const candidate = c.req.path.slice(REDIRECTS_PREFIX.length);
  const from = panelRedirectFromSchema.safeParse(candidate);
  return from.success ? normalisePath(from.data) : undefined;
}

async function listRedirects(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const rows = await allRows(deps.db.prepare(REDIRECTS_LIST), redirectRowSchema);
  return c.json(
    panelRedirectListSchema.parse({
      items: rows.map((row) => ({ from: row.from_path, to: row.to_path })),
    }),
  );
}

async function saveRedirect(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const item = redirectSave(await parseJsonBody(c, panelMutationSchema));
  if (item === undefined) {
    return problemResponse(c, 422);
  }
  const previous = await deps.repos.redirects.target(item.from);
  await atomicWrite(deps, [
    deps.repos.redirects.saveStatement(item),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "redirects.save",
        entity: "redirects",
        entityId: normalisePath(item.from),
        fields: previous === undefined ? createdFields(item) : ["to"],
      }),
    ),
  ]);
  return c.json({ ok: true });
}

async function deleteRedirect(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const path = routePath(c);
  if (path === undefined) {
    return problemResponse(c, 422);
  }
  if ((await deps.repos.redirects.target(path)) === undefined) {
    return problemResponse(c, 404);
  }
  await atomicWrite(deps, [
    deps.repos.redirects.deleteStatement(path),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "redirects.delete",
        entity: "redirects",
        entityId: path,
        fields: ["from"],
      }),
    ),
  ]);
  return c.body(null, 204);
}

export function redirectsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/redirects", panelGuard("redirects.list"), async (c) => listRedirects(c))
    .put("/redirects", panelGuard("redirects.save"), panelJsonOrigin, async (c) => saveRedirect(c))
    .delete("/redirects/:path{.+}", panelGuard("redirects.delete"), panelJsonOrigin, async (c) =>
      deleteRedirect(c),
    );
}
