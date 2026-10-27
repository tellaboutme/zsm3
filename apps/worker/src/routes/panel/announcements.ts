import {
  announcementListSchema,
  type AnnouncementInput,
  type StoredAnnouncement,
} from "@zsm3/contracts/announcements";
import { panelMutationSchema } from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { announcementSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

const ENTITY = "announcements";

function routeId(c: Context<AppEnv>): string | undefined {
  const id = z.uuid().safeParse(c.req.param("id"));
  return id.success ? id.data : undefined;
}

async function stored(c: Context<AppEnv>): Promise<StoredAnnouncement | Response> {
  const id = routeId(c);
  if (id === undefined) {
    return problemResponse(c, 422);
  }
  const item = await requirePanelDeps(c).repos.announcements.get(id);
  return item ?? problemResponse(c, 404);
}

function editable(item: StoredAnnouncement): AnnouncementInput {
  return {
    severity: item.severity,
    text: item.text,
    ...(item.link === undefined ? {} : { link: item.link }),
    startsOn: item.startsOn,
    endsOn: item.endsOn,
  };
}

async function listAnnouncements(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  return c.json(announcementListSchema.parse({ items: await deps.repos.announcements.list() }));
}

async function createAnnouncement(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const item = announcementSave(await parseJsonBody(c, panelMutationSchema));
  if (item === undefined) {
    return problemResponse(c, 422);
  }
  const write = deps.repos.announcements.createStatement(item);
  await atomicWrite(deps, [
    write.statement,
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "announcements.create",
        entity: ENTITY,
        entityId: write.id,
        fields: createdFields(item),
      }),
    ),
  ]);
  return c.json({ ok: true }, 201);
}

async function updateAnnouncement(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const previous = await stored(c);
  if (previous instanceof Response) {
    return previous;
  }
  const item = announcementSave(await parseJsonBody(c, panelMutationSchema));
  if (item === undefined) {
    return problemResponse(c, 422);
  }
  await atomicWrite(deps, [
    deps.repos.announcements.updateStatement(previous.id, item),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "announcements.update",
        entity: ENTITY,
        entityId: previous.id,
        fields: changedFields(editable(previous), item),
      }),
    ),
  ]);
  return c.json({ ok: true });
}

async function deleteAnnouncement(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const previous = await stored(c);
  if (previous instanceof Response) {
    return previous;
  }
  await atomicWrite(deps, [
    deps.repos.announcements.deleteStatement(previous.id),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "announcements.delete",
        entity: ENTITY,
        entityId: previous.id,
        fields: ["text"],
      }),
    ),
  ]);
  return c.body(null, 204);
}

export function announcementsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/announcements", panelGuard("announcements.list"), listAnnouncements)
    .post("/announcements", panelGuard("announcements.create"), panelJsonOrigin, createAnnouncement)
    .put(
      "/announcements/:id",
      panelGuard("announcements.update"),
      panelJsonOrigin,
      updateAnnouncement,
    )
    .delete(
      "/announcements/:id",
      panelGuard("announcements.delete"),
      panelJsonOrigin,
      deleteAnnouncement,
    );
}
