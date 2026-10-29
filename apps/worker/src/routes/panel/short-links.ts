import {
  panelShortLinksListSchema,
  panelShortLinksQuerySchema,
  type PanelShortLinkCursor,
} from "@zsm3/contracts/panel";
import { shortCodeSchema } from "@zsm3/contracts/short-links";
import { Hono } from "hono";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

export function shortLinksRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/short-links", panelGuard("short-links.list"), async (c) => {
      const params = new URL(c.req.url).searchParams;
      if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) {
        return problemResponse(c, 422);
      }
      const query = panelShortLinksQuerySchema.safeParse(Object.fromEntries(params));
      if (!query.success) {
        return problemResponse(c, 422);
      }
      const email = requirePanelSession(c).email;
      const cursor: PanelShortLinkCursor | null =
        query.data.beforeCreatedAt === undefined || query.data.beforeCode === undefined
          ? null
          : { createdAt: query.data.beforeCreatedAt, code: query.data.beforeCode };
      const { limit } = query.data;
      const rows = await requirePanelDeps(c).repos.shortLinks.pageByAuthor(email, cursor, limit);
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      const nextCursor =
        rows.length > limit && last !== undefined
          ? { createdAt: last.createdAt, code: last.code }
          : null;
      return c.json(panelShortLinksListSchema.parse({ items, nextCursor }));
    })
    .delete("/short-links/:code", panelGuard("short-links.revoke"), panelJsonOrigin, async (c) => {
      const code = shortCodeSchema.safeParse(c.req.param("code"));
      if (!code.success) {
        return problemResponse(c, 422);
      }
      const revoked = await requirePanelDeps(c).repos.shortLinks.revoke(
        code.data,
        requirePanelSession(c).email,
      );
      return revoked ? c.body(null, 204) : problemResponse(c, 404);
    });
}
