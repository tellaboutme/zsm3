import { AUDIT_PAGE_SIZE, panelAuditListSchema } from "@zsm3/contracts/audit";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { requirePanelDeps } from "./deps.ts";
import { panelGuard } from "./guards.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { AuditRecord } from "../../storage/audit-repo.ts";

const detailsSchema = z.object({ fields: z.array(z.string()) });

function fieldsOf(details: string): readonly string[] {
  const parsed = detailsSchema.safeParse(JSON.parse(details));
  return parsed.success ? parsed.data.fields : [];
}

function view(record: AuditRecord): object {
  return {
    at: record.at,
    actorEmail: record.actorEmail,
    action: record.action,
    entity: record.entity,
    entityId: record.entityId,
    fields: fieldsOf(record.details),
  };
}

const CURSOR = /^(?<at>[0-9TZ:.-]{1,40})\|(?<id>[0-9a-f-]{1,40})$/u;

interface Cursor {
  readonly at: string;
  readonly id: string;
}

function cursorOf(raw: string | undefined): Cursor | "none" | "invalid" {
  if (raw === undefined) {
    return "none";
  }
  const groups = CURSOR.exec(raw)?.groups;
  return groups === undefined ? "invalid" : { at: String(groups["at"]), id: String(groups["id"]) };
}

function cursorText(record: AuditRecord): string {
  return `${record.at}|${record.id}`;
}

async function listAudit(c: Context<AppEnv>): Promise<Response> {
  const audit = requirePanelDeps(c).repos.audit;
  const cursor = cursorOf(c.req.query("before"));
  if (cursor === "invalid") {
    return problemResponse(c, 422);
  }
  const records =
    cursor === "none"
      ? await audit.list(AUDIT_PAGE_SIZE + 1)
      : await audit.before(cursor.at, cursor.id, AUDIT_PAGE_SIZE + 1);
  const page = records.slice(0, AUDIT_PAGE_SIZE);
  const next = records.length > AUDIT_PAGE_SIZE ? page.slice(-1).map(cursorText).join("") : null;
  return c.json(panelAuditListSchema.parse({ items: page.map(view), next }));
}

export function auditRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get("/audit", panelGuard("audit.list"), listAudit);
}
