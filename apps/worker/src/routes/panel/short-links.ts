import {
  panelShortLinkCreatedSchema,
  panelShortLinksListSchema,
  panelShortLinksQuerySchema,
  type PanelShortLinkCursor,
} from "@zsm3/contracts/panel";
import { shortCodeSchema } from "@zsm3/contracts/short-links";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";

import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin, panelOrigin } from "./guards.ts";
import { uniqueQuery } from "./http.ts";
import { MAX_LINK_UPLOAD_BODY_BYTES, uploadLinkFile } from "./short-link-files.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse, type ProblemStatus } from "../../http/problem.ts";
import { createShortLink, type CreateOutcome } from "../../short-links/create.ts";

const REFUSED_STATUS: Readonly<
  Record<Exclude<CreateOutcome, { readonly kind: "created" }>["kind"], ProblemStatus>
> = {
  invalid: 422,
  unavailable: 503,
  exhausted: 503,
};

async function listLinks(c: Context<AppEnv>): Promise<Response> {
  const query = panelShortLinksQuerySchema.safeParse(uniqueQuery(c));
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
}

async function readJson(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

async function createLink(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const email = requirePanelSession(c).email;
  const outcome = await createShortLink(
    { links: deps.repos.shortLinks, random: deps.random, passwordKey: c.env.SHORT_LINK_KEY },
    { body: await readJson(c), createdBy: email, now: deps.clock() },
  );
  if (outcome.kind !== "created") {
    return problemResponse(c, REFUSED_STATUS[outcome.kind]);
  }
  const item = await deps.repos.shortLinks.created(outcome.code, email);
  return c.json(panelShortLinkCreatedSchema.parse({ item }), 201);
}

export function shortLinksRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/short-links", panelGuard("short-links.list"), async (c) => listLinks(c))
    .post("/short-links", panelGuard("short-links.create"), panelJsonOrigin, async (c) =>
      createLink(c),
    )
    .post(
      "/short-links/files",
      panelGuard("short-links.create"),
      panelOrigin,
      bodyLimit({ maxSize: MAX_LINK_UPLOAD_BODY_BYTES }),
      async (c) => uploadLinkFile(c),
    )
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
