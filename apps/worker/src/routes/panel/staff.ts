import { panelMutationSchema, panelStaffListSchema } from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { staffSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

async function listStaff(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const members = await deps.repos.staff.list();
  return c.json(
    panelStaffListSchema.parse({
      items: members.map(({ email, role, active, updatedAt }) => ({
        email,
        role,
        active,
        updatedAt,
      })),
    }),
  );
}

async function saveStaff(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const item = staffSave(await parseJsonBody(c, panelMutationSchema));
  if (item === undefined) {
    return problemResponse(c, 422);
  }
  if (item.email === session.email && (item.role !== "admin" || !item.active)) {
    return problemResponse(c, 422, "Own Access Unchanged");
  }
  const previous = await deps.repos.staff.get(item.email);
  const fields =
    previous === undefined
      ? createdFields(item)
      : changedFields(
          { email: previous.email, role: previous.role, active: previous.active },
          item,
        );
  await atomicWrite(deps, [
    deps.repos.staff.saveStatement(item),
    deps.repos.audit.statement(
      auditEntry({ session, action: "staff.save", entity: "staff", entityId: item.email, fields }),
    ),
  ]);
  return c.json({ ok: true });
}

export function staffRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/staff", panelGuard("staff.list"), async (c) => listStaff(c))
    .put("/staff", panelGuard("staff.save"), panelJsonOrigin, async (c) => saveStaff(c));
}
