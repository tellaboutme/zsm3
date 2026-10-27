import { bellScheduleViewSchema } from "@zsm3/contracts/bells";
import { panelMutationSchema } from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { bellsSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

async function showBells(c: Context<AppEnv>): Promise<Response> {
  const schedule = await requirePanelDeps(c).repos.bells.get();
  if (schedule === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(bellScheduleViewSchema.parse({ schedule }));
}

async function saveBells(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const schedule = bellsSave(await parseJsonBody(c, panelMutationSchema));
  if (schedule === undefined) {
    return problemResponse(c, 422);
  }
  const previous = await deps.repos.bells.get();
  await atomicWrite(deps, [
    deps.repos.bells.saveStatement(schedule),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "bells.save",
        entity: "bells",
        entityId: "schedule",
        fields:
          previous === undefined ? createdFields(schedule) : changedFields(previous, schedule),
      }),
    ),
  ]);
  return c.json({ ok: true });
}

export function bellsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/bells", panelGuard("bells.get"), showBells)
    .put("/bells", panelGuard("bells.save"), panelJsonOrigin, saveBells);
}
