import { panelAdminShortLinksListSchema, panelShortLinksQuerySchema } from "@zsm3/contracts/panel";
import { shortCodeSchema } from "@zsm3/contracts/short-links";
import type { Context, Hono } from "hono";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { uniqueQuery } from "./http.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

export const ADMIN_LINKS_PATH = "/short-links/all";

async function listActive(c: Context<AppEnv>): Promise<Response> {
  const query = panelShortLinksQuerySchema.safeParse(uniqueQuery(c));
  if (!query.success) {
    return problemResponse(c, 422);
  }
  const { limit, beforeCreatedAt, beforeCode } = query.data;
  const deps = requirePanelDeps(c);
  const cursor =
    beforeCreatedAt === undefined || beforeCode === undefined
      ? null
      : { createdAt: beforeCreatedAt, code: beforeCode };
  const rows = await deps.repos.shortLinksAdmin.active({
    now: deps.clock().toISOString(),
    cursor,
    limit,
  });
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last !== undefined
      ? { createdAt: last.createdAt, code: last.code }
      : null;
  return c.json(panelAdminShortLinksListSchema.parse({ items, nextCursor }));
}

async function revokeAny(c: Context<AppEnv>): Promise<Response> {
  const code = shortCodeSchema.safeParse(c.req.param("code"));
  if (!code.success) {
    return problemResponse(c, 422);
  }
  const revoked = await requirePanelDeps(c).repos.shortLinksAdmin.revokeAny(
    code.data,
    requirePanelSession(c).email,
  );
  return revoked ? c.body(null, 204) : problemResponse(c, 404);
}

export function withAdminLinkRoutes(routes: Hono<AppEnv>): Hono<AppEnv> {
  return routes
    .get(ADMIN_LINKS_PATH, panelGuard("short-links.all"), async (c) => listActive(c))
    .delete(
      `${ADMIN_LINKS_PATH}/:code`,
      panelGuard("short-links.admin-revoke"),
      panelJsonOrigin,
      async (c) => revokeAny(c),
    );
}
