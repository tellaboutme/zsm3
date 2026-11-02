import type { Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import type { PanelDeps } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { SqlStatement } from "../../storage/database.ts";

export const CONTENT_CHANGED = "Content Changed";

export type VersionedEntity = "news" | "pages" | "datasets";

export function contentChanged(c: Context<AppEnv>): Response {
  return problemResponse(c, 409, CONTENT_CHANGED);
}

export async function atRevision(
  deps: PanelDeps,
  entity: VersionedEntity,
  entityId: string,
  expected: number,
): Promise<boolean> {
  return (await deps.repos.revisions.current(entity, entityId)) === expected;
}

export async function committed(
  deps: PanelDeps,
  statements: readonly SqlStatement[],
  unchanged: () => Promise<boolean>,
): Promise<boolean> {
  try {
    await atomicWrite(deps, statements);
    return true;
  } catch (error) {
    if (await unchanged()) {
      throw error;
    }
    return false;
  }
}
