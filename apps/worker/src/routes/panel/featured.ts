import {
  featuredSetSchema,
  featuredSlotSchema,
  panelFeaturedListSchema,
  type FeaturedSlot,
} from "@zsm3/contracts/featured";
import { Hono, type Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

const ENTITY = "featured";

function requestedSlot(c: Context<AppEnv>): FeaturedSlot | undefined {
  const slot = featuredSlotSchema.safeParse(c.req.param("slot"));
  return slot.success ? slot.data : undefined;
}

async function listFeatured(c: Context<AppEnv>): Promise<Response> {
  const items = await requirePanelDeps(c).repos.featured.list();
  return c.json(panelFeaturedListSchema.parse({ items }));
}

async function setFeatured(c: Context<AppEnv>): Promise<Response> {
  const slot = requestedSlot(c);
  if (slot === undefined) {
    return problemResponse(c, 404);
  }
  const input = await parseJsonBody(c, featuredSetSchema);
  if (input === undefined) {
    return problemResponse(c, 422);
  }
  const deps = requirePanelDeps(c);
  if (!(await deps.repos.featured.livePhoto(input.photoId))) {
    return problemResponse(c, 422, "Photo Not Found");
  }
  const session = requirePanelSession(c);
  await atomicWrite(deps, [
    deps.repos.featured.setStatement(slot, input.photoId, session.email),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "featured.set",
        entity: ENTITY,
        entityId: slot,
        fields: ["photoId"],
      }),
    ),
  ]);
  return c.json({ ok: true });
}

async function clearFeatured(c: Context<AppEnv>): Promise<Response> {
  const slot = requestedSlot(c);
  const deps = requirePanelDeps(c);
  if (slot === undefined || !(await deps.repos.featured.stored(slot))) {
    return problemResponse(c, 404);
  }
  const session = requirePanelSession(c);
  await atomicWrite(deps, [
    deps.repos.featured.clearStatement(slot),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "featured.clear",
        entity: ENTITY,
        entityId: slot,
        fields: ["photoId"],
      }),
    ),
  ]);
  return c.body(null, 204);
}

export function featuredRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/featured", panelGuard("featured.list"), listFeatured)
    .put("/featured/:slot", panelGuard("featured.set"), panelJsonOrigin, setFeatured)
    .delete("/featured/:slot", panelGuard("featured.clear"), panelJsonOrigin, clearFeatured);
}
