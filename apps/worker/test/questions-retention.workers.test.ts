import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, it } from "vitest";

import { ACTIVE_PII_KEY_ID, MissingSecretError, piiKeys } from "../src/env.ts";
import { runScheduledMaintenance } from "../src/jobs/retention.ts";
import { seal } from "../src/questions/sealing.ts";
import { piiCrypto } from "../src/security/pii-crypto.ts";
import { liveStore } from "../src/storage/database.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { questionsRepo } from "../src/storage/questions-repo.ts";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

async function count(): Promise<number | null> {
  return env.DB.prepare("SELECT count(*) AS total FROM questions").first<number>("total");
}

it("deletes an expired question on D1 even when e-wniosek is not configured", async ({
  expect,
}) => {
  const store = liveStore(env.DB);
  const crypto = piiCrypto(piiKeys(env), ACTIVE_PII_KEY_ID, cryptoRandom);
  for (const [id, receivedOn] of [
    ["00000000-0000-4000-8000-000000000201", "2020-01-01"],
    ["00000000-0000-4000-8000-000000000202", new Date().toISOString().slice(0, 10)],
  ] as const) {
    await questionsRepo(store).receive({
      id,
      addressee: "pedagogue",
      question: await seal(crypto, "question", id, "Pytanie testowe na D1."),
      formKey: id,
      receivedOn,
    });
  }

  await expect(
    runScheduledMaintenance({ DB: env.DB, MEDIA: env.MEDIA }, store, new Date()),
  ).rejects.toThrow(MissingSecretError);

  expect(await count()).toBe(1);
});
