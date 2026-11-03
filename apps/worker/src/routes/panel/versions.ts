import type { Context } from "hono";

import { atomicWrite } from "./atomic.ts";
import type { PanelDeps } from "./deps.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import { logEvent } from "../../logging/log.ts";
import type { SqlStatement, WriteReceipt } from "../../storage/database.ts";

export const CONTENT_CHANGED = "Content Changed";

export type VersionedEntity = "news" | "pages" | "datasets";

export interface PlannedWrite {
  readonly receipt: WriteReceipt;
  readonly statements: readonly SqlStatement[];
}

export interface GuardedWrite extends PlannedWrite {
  readonly unchanged: () => Promise<boolean>;
}

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

async function settled(write: GuardedWrite): Promise<boolean | undefined> {
  if (await write.receipt.landed()) {
    return true;
  }
  return (await write.unchanged()) ? undefined : false;
}

export async function committed(deps: PanelDeps, write: GuardedWrite): Promise<boolean> {
  try {
    await atomicWrite(deps, [write.receipt.statement, ...write.statements]);
    return true;
  } catch (error) {
    const outcome = await settled(write).catch(() => undefined);
    if (outcome === undefined) {
      throw error;
    }
    if (outcome) {
      logEvent({
        event: "panel_write_recovered",
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
    return outcome;
  }
}
