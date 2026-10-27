import { panelMutationSchema } from "@zsm3/contracts/panel";
import {
  MAX_LISTED_REVISIONS,
  panelRevisionListSchema,
  revisionTargetSchema,
} from "@zsm3/contracts/revisions";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { revisionRestore } from "./mutations.ts";
import { RESTORE_PLANS } from "./revision-plans.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";

const summarySchema = z.object({
  title: z.string(),
  status: z.enum(["draft", "published"]),
});

async function listRevisions(c: Context<AppEnv>): Promise<Response> {
  const target = revisionTargetSchema.safeParse(c.req.param("target"));
  const id = z.string().min(1).max(300).safeParse(c.req.query("id"));
  if (!target.success || !id.success) {
    return problemResponse(c, 422);
  }
  const revisions = await requirePanelDeps(c).repos.revisions.recent(
    target.data,
    id.data,
    MAX_LISTED_REVISIONS,
  );
  const items = revisions.flatMap((revision) => {
    const summary =
      target.data === "datasets"
        ? summarySchema.safeParse({ title: `Zestaw ${id.data}`, status: "published" })
        : summarySchema.safeParse(JSON.parse(revision.dataJson));
    return summary.success
      ? [
          {
            revision: revision.revision,
            at: revision.at,
            actorEmail: revision.actorEmail,
            ...summary.data,
          },
        ]
      : [];
  });
  return c.json(panelRevisionListSchema.parse({ items }));
}

async function restoreRevision(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const restore = revisionRestore(await parseJsonBody(c, panelMutationSchema));
  if (restore === undefined) {
    return problemResponse(c, 422);
  }
  const revision = await deps.repos.revisions.find(restore.target, restore.id, restore.revision);
  if (revision === undefined) {
    return problemResponse(c, 404);
  }
  const data: unknown = JSON.parse(revision.dataJson);
  const plan = await RESTORE_PLANS[restore.target](c, restore, data);
  if (typeof plan === "number") {
    return problemResponse(c, plan === 404 ? 404 : 422);
  }
  await atomicWrite(deps, [
    ...plan.writes,
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: `${restore.target}.restore`,
        entity: restore.target,
        entityId: restore.id,
        fields: changedFields(plan.before, plan.after),
      }),
    ),
  ]);
  return c.json({ ok: true });
}

export function revisionsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/revisions/:target", panelGuard("revisions.list"), listRevisions)
    .post("/revisions/restore", panelGuard("revisions.restore"), panelJsonOrigin, restoreRevision);
}
