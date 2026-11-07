import type { PanelRouteName } from "@zsm3/contracts/panel";

import type { PanelHarness } from "./panel-support.ts";
import { panelJsonCall } from "./panel-support.ts";
import { seal } from "../../src/questions/sealing.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { questionsRepo } from "../../src/storage/questions-repo.ts";

interface RouteCase {
  readonly name: PanelRouteName;
  readonly call: (token: string) => Promise<Response>;
}

const draftIds = new Map<string, string>();
const decideIds = new Map<string, string>();

export const QUESTION_OK_STATUS = {
  "questions.list": 200,
  "questions.get": 200,
  "questions.draft": 200,
  "questions.decide": 200,
} as const;

export const MATRIX_QUESTION = "Jak umówić się na rozmowę z pedagogiem szkolnym?";

async function receivedQuestion(harness: PanelHarness): Promise<string> {
  const store = { db: harness.env.DB, clock: systemClock, random: cryptoRandom };
  const crypto = piiCrypto({ PRIMARY: "a".repeat(32) }, "PRIMARY", cryptoRandom);
  const id = globalThis.crypto.randomUUID();
  await questionsRepo(store).receive({
    id,
    addressee: "pedagogue",
    question: await seal(crypto, "question", id, MATRIX_QUESTION),
    formKey: globalThis.crypto.randomUUID(),
    receivedOn: "2026-10-20",
  });
  return id;
}

export async function seedMatrixQuestions(
  harness: PanelHarness,
  keys: readonly string[],
): Promise<void> {
  for (const key of keys) {
    draftIds.set(key, await receivedQuestion(harness));
    decideIds.set(key, await receivedQuestion(harness));
  }
}

function idFor(ids: ReadonlyMap<string, string>, key: string | undefined): string {
  const id = key === undefined ? undefined : ids.get(key);
  if (id === undefined) {
    throw new Error("fixture");
  }
  return id;
}

export function questionCases(
  harness: PanelHarness,
  rolesByToken: ReadonlyMap<string, string>,
): readonly RouteCase[] {
  return [
    {
      name: "questions.list",
      call: async (token) => panelJsonCall(harness, "GET", "/questions", { token }),
    },
    {
      name: "questions.get",
      call: async (token) =>
        panelJsonCall(harness, "GET", `/questions/${idFor(draftIds, "shared")}`, { token }),
    },
    {
      name: "questions.draft",
      call: async (token) =>
        panelJsonCall(
          harness,
          "PUT",
          `/questions/${idFor(draftIds, rolesByToken.get(token))}/draft`,
          { token, body: { expectedVersion: 1, question: MATRIX_QUESTION, answer: "Napisz." } },
        ),
    },
    {
      name: "questions.decide",
      call: async (token) =>
        panelJsonCall(
          harness,
          "POST",
          `/questions/${idFor(decideIds, rolesByToken.get(token))}/decision`,
          { token, body: { action: "reject", expectedVersion: 1 } },
        ),
    },
  ];
}
