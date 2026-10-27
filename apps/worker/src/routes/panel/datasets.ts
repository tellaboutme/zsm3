import {
  datasetKeySchema,
  datasetSchemas,
  panelDatasetViewSchema,
  type DatasetKey,
} from "@zsm3/contracts/datasets";
import { panelMutationSchema } from "@zsm3/contracts/panel";
import { Hono, type Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { datasetSave } from "./mutations.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { SqlStatement } from "../../storage/database.ts";

function routeKey(c: Context<AppEnv>): DatasetKey | undefined {
  const key = datasetKeySchema.safeParse(c.req.param("key"));
  return key.success ? key.data : undefined;
}

export function mediaReferences(value: unknown): readonly string[] {
  const text = JSON.stringify(value);
  return [...text.matchAll(/"href":"\/media\/(d\/[0-9a-f]{64}\.[a-z0-9]{2,4})"/gu)].map((match) =>
    String(match[1]),
  );
}

async function showDataset(c: Context<AppEnv>): Promise<Response> {
  const key = routeKey(c);
  if (key === undefined) {
    return problemResponse(c, 422);
  }
  const stored = await requirePanelDeps(c).repos.datasets.get(key);
  if (stored === undefined) {
    return problemResponse(c, 404);
  }
  return c.json(panelDatasetViewSchema.parse(stored));
}

async function saveDataset(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const key = routeKey(c);
  const save = datasetSave(await parseJsonBody(c, panelMutationSchema));
  if (key === undefined || save?.key !== key) {
    return problemResponse(c, 422);
  }
  const parsed = datasetSchemas[key].safeParse(save.data);
  if (!parsed.success) {
    return problemResponse(c, 422);
  }
  for (const reference of mediaReferences(parsed.data)) {
    if ((await deps.repos.files.find(reference)) === undefined) {
      return problemResponse(c, 422, "Unknown File");
    }
  }
  const previous = await deps.repos.datasets.get(key);
  const writes: SqlStatement[] = [];
  if (previous !== undefined) {
    writes.push(
      deps.repos.revisions.statement("datasets", key, JSON.stringify(previous.data), session.email),
    );
  }
  writes.push(deps.repos.datasets.saveStatement(key, parsed.data));
  writes.push(
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "datasets.save",
        entity: "datasets",
        entityId: key,
        fields: [key],
      }),
    ),
  );
  await atomicWrite(deps, writes);
  return c.json({ ok: true });
}

export function datasetsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/datasets/:key", panelGuard("datasets.get"), showDataset)
    .put("/datasets/:key", panelGuard("datasets.save"), panelJsonOrigin, saveDataset);
}
