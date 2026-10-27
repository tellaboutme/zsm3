import type { SchoolEvent } from "@zsm3/contracts/content";
import {
  panelEventListSchema,
  panelMutationSchema,
  schoolYearLabel,
  schoolYearParamSchema,
  schoolYearRange,
} from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { eventsSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

function routeYear(c: Context<AppEnv>): number | undefined {
  const year = schoolYearParamSchema.safeParse(c.req.param("year"));
  return year.success ? year.data : undefined;
}

export function eventOutsideSchoolYear(
  event: SchoolEvent,
  range: readonly [string, string],
): boolean {
  const [from, to] = range;
  return (
    event.date < from ||
    event.date > to ||
    (event.endDate !== undefined && (event.endDate < from || event.endDate > to))
  );
}

async function showEvents(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const year = routeYear(c);
  if (year === undefined) {
    return problemResponse(c, 422);
  }
  const [from, to] = schoolYearRange(year);
  return c.json(panelEventListSchema.parse({ items: await deps.repos.events.between(from, to) }));
}

async function saveEvents(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const year = routeYear(c);
  if (year === undefined) {
    return problemResponse(c, 422);
  }
  const events = eventsSave(await parseJsonBody(c, panelMutationSchema));
  if (events === undefined) {
    return problemResponse(c, 422);
  }
  const range = schoolYearRange(year);
  const outside = events.find((event) => eventOutsideSchoolYear(event, range));
  if (outside !== undefined) {
    return problemResponse(c, 422, "Event Outside School Year");
  }
  const [from, to] = range;
  await atomicWrite(deps, [
    ...deps.repos.events.replaceStatements(from, to, events),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "events.save",
        entity: "events",
        entityId: schoolYearLabel(year),
        fields: ["events"],
      }),
    ),
  ]);
  return c.json({ ok: true });
}

export function eventsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/events/:year", panelGuard("events.get"), async (c) => showEvents(c))
    .put("/events/:year", panelGuard("events.save"), panelJsonOrigin, async (c) => saveEvents(c));
}
