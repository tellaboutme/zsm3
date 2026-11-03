import { z } from "zod";

import { staffMember } from "./panel-fixtures.ts";
import {
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
  type PanelHarness,
} from "./panel-support.ts";
import { seal } from "../../src/questions/sealing.ts";
import { piiCrypto, type PiiCrypto } from "../../src/security/pii-crypto.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";
import { allRows, systemClock, type Store } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { questionsRepo, type QuestionsRepo } from "../../src/storage/questions-repo.ts";

const auditRowSchema = z.object({
  action: z.string(),
  actor_email: z.string().nullable(),
  details_json: z.string(),
});

export const ORIGINAL =
  "Mam problem z Ewą Przykładową z klasy 9Z, co robić? Mój numer to 000 000 000.";
export const REDACTED = "Mam problem z koleżanką z klasy. Co mogę zrobić?";
export const ANSWER = "Porozmawiaj z wychowawcą albo przyjdź do pedagoga w czasie dyżuru.";

export interface QuestionsPanel {
  readonly harness: PanelHarness;
  readonly store: Store;
  readonly repo: QuestionsRepo;
  readonly crypto: PiiCrypto;
  readonly tokens: Readonly<Record<"counsellor" | "second" | "admin", string>>;
  receive(text?: string, receivedOn?: string): Promise<string>;
  call(
    method: string,
    path: string,
    body?: unknown,
    token?: "counsellor" | "second" | "admin",
  ): Promise<Response>;
  auditActions(id: string): Promise<readonly (readonly [string, string | null, string])[]>;
}

export async function questionsPanel(indexnow?: IndexNowEndpoint): Promise<QuestionsPanel> {
  const harness = await panelHarness(indexnow === undefined ? {} : { indexnow });
  await seedStaff(harness.env, [
    staffMember("pedagog@zsm3.test", "counsellor", true),
    staffMember("psycholog@zsm3.test", "counsellor", true),
    staffMember("admin@zsm3.test", "admin", true),
  ]);
  const store: Store = { db: harness.env.DB, clock: systemClock, random: cryptoRandom };
  const repo = questionsRepo(store);
  const crypto = piiCrypto({ PRIMARY: "a".repeat(32) }, "PRIMARY", cryptoRandom);
  const tokens = {
    counsellor: await harness.keys.sign(staffClaims("pedagog@zsm3.test")),
    second: await harness.keys.sign(staffClaims("psycholog@zsm3.test")),
    admin: await harness.keys.sign(staffClaims("admin@zsm3.test")),
  };
  return {
    harness,
    store,
    repo,
    crypto,
    tokens,
    receive: async (text = ORIGINAL, receivedOn = "2026-10-20") => {
      const id = globalThis.crypto.randomUUID();
      await repo.receive({
        id,
        addressee: "pedagogue",
        question: await seal(crypto, "question", id, text),
        formKey: globalThis.crypto.randomUUID(),
        receivedOn,
      });
      return id;
    },
    call: async (method, path, body, token = "counsellor") =>
      panelJsonCall(harness, method, path, {
        token: tokens[token],
        ...(body === undefined ? {} : { body }),
      }),
    auditActions: async (id) => {
      const rows = await allRows(
        harness.env.DB.prepare(
          "SELECT action, actor_email, details_json FROM audit_log WHERE entity_id = ? ORDER BY at, id",
        ).bind(id),
        auditRowSchema,
      );
      return rows.map((row) => [row.action, row.actor_email, row.details_json] as const);
    },
  };
}
