import {
  panelRequestsListSchema,
  panelRequestsQuerySchema,
  panelRequestTransitionSchema,
  type PanelRequestsQuery,
} from "@zsm3/contracts/panel-requests";
import { panelRequestDetailSchema, requestPiiSchema } from "@zsm3/contracts/requests";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { auditEntry } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import type { AppEnv } from "../../app-env.ts";
import { canTransition } from "../../domain/request-lifecycle.ts";
import { problemResponse } from "../../http/problem.ts";
import { batchChanges } from "../../storage/database.ts";
import type { RequestListFilter } from "../../storage/requests-repo.ts";

const ENTITY = "requests";

function uniqueQuery(c: Context<AppEnv>): Record<string, string> | undefined {
  const params = new URL(c.req.url).searchParams;
  return [...params.keys()].some((key) => params.getAll(key).length !== 1)
    ? undefined
    : Object.fromEntries(params);
}

function summaryOf(record: {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function listFilter({ status, before, beforeId, limit }: PanelRequestsQuery): RequestListFilter {
  return {
    ...(status === undefined ? {} : { status }),
    ...(before === undefined ? {} : { before }),
    ...(beforeId === undefined ? {} : { beforeId }),
    limit: limit + 1,
  };
}

async function listRequests(c: Context<AppEnv>): Promise<Response> {
  const params = uniqueQuery(c);
  const query = params === undefined ? undefined : panelRequestsQuerySchema.safeParse(params);
  if (query?.success !== true) {
    return problemResponse(c, 422);
  }
  const { limit } = query.data;
  const rows = await requirePanelDeps(c).repos.requests.list(listFilter(query.data));
  const items = rows.slice(0, limit);
  const last = rows.length > limit ? items.at(-1) : undefined;
  return c.json(
    panelRequestsListSchema.parse({
      items: items.map(summaryOf),
      nextBefore: last?.createdAt ?? null,
      nextBeforeId: last?.id ?? null,
    }),
  );
}

async function showRequest(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) {
    return problemResponse(c, 404);
  }
  const record = await deps.repos.requests.findById(id.data);
  if (record === undefined) {
    return problemResponse(c, 404);
  }
  const base = { ...summaryOf(record), piiErasedAt: record.piiErasedAt };
  if (record.piiCiphertext === null || record.piiKeyId === null) {
    return c.json(
      panelRequestDetailSchema.parse({
        ...base,
        firstName: null,
        lastName: null,
        className: null,
        graduationYear: null,
        email: null,
        note: null,
      }),
    );
  }
  const plaintext = await deps.piiCrypto.decrypt(record.piiCiphertext, record.piiKeyId, record.id);
  const pii = requestPiiSchema.parse(JSON.parse(plaintext));
  return c.json(
    panelRequestDetailSchema.parse({
      ...base,
      firstName: pii.firstName,
      lastName: pii.lastName,
      className: pii.className ?? null,
      graduationYear: pii.graduationYear ?? null,
      email: pii.email,
      note: pii.note ?? null,
    }),
  );
}

async function transitionRequest(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) {
    return problemResponse(c, 404);
  }
  const body = await parseJsonBody(c, panelRequestTransitionSchema);
  if (body === undefined) {
    return problemResponse(c, 422);
  }
  const record = await deps.repos.requests.findById(id.data);
  if (record === undefined) {
    return problemResponse(c, 404);
  }
  if (!canTransition(record.status, body.to)) {
    return problemResponse(c, 422, "Invalid Status Transition");
  }
  const transition = deps.repos.requests.transitionStatements({
    id: record.id,
    from: record.status,
    to: body.to,
    origin: deps.origin,
    audit: auditEntry({
      session,
      action: "requests.transition",
      entity: ENTITY,
      entityId: record.id,
      fields: ["status"],
    }),
  });
  const changes = batchChanges(await deps.db.batch([...transition.statements]));
  if (!transition.applied(changes)) {
    return problemResponse(c, 409, "Request Status Changed");
  }
  return c.json({ ok: true });
}

export function requestsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/requests", panelGuard("requests.list"), listRequests)
    .get("/requests/:id", panelGuard("requests.get"), showRequest)
    .post(
      "/requests/:id/status",
      panelGuard("requests.transition"),
      panelJsonOrigin,
      transitionRequest,
    );
}
