import type { Hono } from "hono";

import { memoryDatabase, type MemoryDatabase } from "./memory-database.ts";
import { staffMember } from "./panel-fixtures.ts";
import {
  memoryBucket,
  panelKeys,
  PANEL_AUDIENCE,
  PANEL_DOMAIN,
  PANEL_ISSUER,
  PANEL_ORIGIN,
  VERIFIER_CLOCK,
  staffClaims,
  type PanelKeys,
} from "./panel-support.ts";
import { createApp } from "../../src/app.ts";
import type { PanelRuntimeEnv } from "../../src/routes/panel/deps.ts";
import type { AccessVerifier } from "../../src/security/access-jwt.ts";
import { createAccessVerifier } from "../../src/security/access-jwt.ts";
import type { SqlDatabase, SqlStatement } from "../../src/storage/database.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

export const SPY_ADMIN = staffMember("admin@zsm3.test", "admin", true);

export type PanelSqlBatch = readonly SqlStatement[];

export interface PanelSpyHarness {
  readonly app: Hono<PanelRuntimeEnv>;
  readonly keys: PanelKeys;
  readonly env: Env;
  readonly memory: MemoryDatabase;
  readonly batches: readonly PanelSqlBatch[];
  readonly failAudit: () => void;
}

async function spyStatementRunner(
  memory: MemoryDatabase,
  snapshot: PanelSqlBatch,
): Promise<unknown> {
  memory.sqlite.exec("BEGIN");
  try {
    for (const [index, statement] of snapshot.entries()) {
      if (index === snapshot.length - 1 && snapshot.length > 1) {
        throw new Error("audit insert failed");
      }
      const run = statement.run();
      await run;
    }
    memory.sqlite.exec("COMMIT");
    return [];
  } catch {
    memory.sqlite.exec("ROLLBACK");
    throw new Error("audit insert failed");
  }
}

export async function panelSpyHarness(): Promise<PanelSpyHarness> {
  const keys = await panelKeys();
  const verifier: AccessVerifier = createAccessVerifier({
    jwks: keys.jwks,
    audience: PANEL_AUDIENCE,
    issuer: PANEL_ISSUER,
    now: VERIFIER_CLOCK,
  });
  const memory = memoryDatabase();
  const batches: PanelSqlBatch[] = [];
  let failing = false;
  const db: SqlDatabase = {
    prepare: (query) => memory.prepare(query),
    batch: async (statements) => {
      const snapshot: PanelSqlBatch = [...statements];
      batches.push(snapshot);
      return failing ? spyStatementRunner(memory, snapshot) : memory.batch(statements);
    },
  };
  return {
    app: createApp({ verifier, origin: PANEL_ORIGIN }),
    keys,
    env: {
      DB: db,
      MEDIA: memoryBucket(),
      ACCESS_TEAM_DOMAIN: PANEL_DOMAIN,
      ACCESS_AUDIENCE: PANEL_AUDIENCE,
      PANEL_ORIGIN,
    },
    memory,
    batches,
    failAudit: () => {
      failing = true;
    },
  };
}

export function spyStore(harness: PanelSpyHarness): {
  db: MemoryDatabase;
  clock: () => Date;
  random: (length: number) => Uint8Array;
} {
  return { db: harness.memory, clock: systemClock, random: cryptoRandom };
}

export function spyTotal(harness: PanelSpyHarness, query: string): unknown {
  return harness.memory.sqlite.prepare(query).get();
}

export async function spyToken(harness: PanelSpyHarness): Promise<string> {
  return harness.keys.sign(staffClaims(SPY_ADMIN.email));
}
