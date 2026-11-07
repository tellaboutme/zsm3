import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { SECRETS } from "./request-harness.ts";
import { seedQuestionBox, seedQuestions } from "../../seed/questions.ts";
import { canChange, isClosed, targetStatus } from "../../src/domain/question-lifecycle.ts";
import { MissingSecretError } from "../../src/env.ts";
import { questionsConfig } from "../../src/questions/config.ts";
import { seal, unseal } from "../../src/questions/sealing.ts";
import { PiiDecryptionError, piiCrypto } from "../../src/security/pii-crypto.ts";
import type { Store } from "../../src/storage/database.ts";
import { publicSlug, uuidv4 } from "../../src/storage/ids.ts";
import { questionsRepo } from "../../src/storage/questions-repo.ts";

const crypto = piiCrypto({ PRIMARY: "k".repeat(32) }, "PRIMARY", counterRandom());
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("local seed", () => {
  it("publishes two synthetic answers, queues one question and is idempotent", async ({
    expect,
  }) => {
    const live = store();
    const first = await seedQuestionBox(live, crypto);
    const second = await seedQuestionBox(live, crypto);
    const repo = questionsRepo(live);

    expect([first, second]).toEqual([3, 0]);
    expect(await repo.publishedCount()).toBe(2);
    expect((await repo.list({ status: "received", limit: 5 })).map((row) => row.id)).toEqual([
      seedQuestions[2]?.id,
    ]);
    expect((await repo.published(5, 0)).map((item) => item.addressee)).toEqual([
      "leadership",
      "psychologist",
    ]);
  });
});

describe("question lifecycle", () => {
  it("allows exactly the documented moves", ({ expect }) => {
    const statuses = ["received", "draft", "published", "rejected", "withdrawn"] as const;
    const changes = ["draft", "publish", "reject", "withdraw", "delete"] as const;
    const table = Object.fromEntries(
      changes.map((change) => [change, statuses.filter((status) => canChange(change, status))]),
    );

    expect(table).toEqual({
      draft: ["received", "draft", "withdrawn"],
      publish: ["draft"],
      reject: ["received", "draft", "withdrawn"],
      withdraw: ["published"],
      delete: ["received", "draft", "rejected", "withdrawn"],
    });
    expect((["draft", "publish", "reject", "withdraw"] as const).map(targetStatus)).toEqual([
      "draft",
      "published",
      "rejected",
      "withdrawn",
    ]);
    expect(statuses.filter((status) => isClosed(status))).toEqual(["rejected", "withdrawn"]);
  });
});

describe("question identifiers and sealing", () => {
  it("builds random v4 ids and unambiguous public slugs", ({ expect }) => {
    const random = counterRandom();
    expect(uuidv4(random)).toBe("01010101-0101-4101-8101-010101010101");
    expect(uuidv4(() => new Uint8Array(16).fill(0xff))).toBe(
      "ffffffff-ffff-4fff-bfff-ffffffffffff",
    );
    expect(publicSlug(() => Uint8Array.from([0, 31, 32, 255, 8, 11]), 6)).toBe("a9a9im");
    expect(publicSlug(counterRandom(), 12)).toMatch(/^[a-z2-9]{12}$/u);
  });

  it("binds each sealed text to its own row and purpose", async ({ expect }) => {
    const sealed = await seal(crypto, "question", ID(1), "Tajne pytanie");

    expect(await unseal(crypto, "question", ID(1), sealed)).toBe("Tajne pytanie");
    await expect(unseal(crypto, "draft", ID(1), sealed)).rejects.toThrow(PiiDecryptionError);
    await expect(unseal(crypto, "question", ID(2), sealed)).rejects.toThrow(PiiDecryptionError);
  });

  it("needs the active key, the rate-limit salt and the Turnstile secret", ({ expect }) => {
    expect(questionsConfig(SECRETS)).toMatchObject({ activePiiKeyId: "PRIMARY" });
    expect(() => questionsConfig({ ...SECRETS, TURNSTILE_SECRET_KEY: undefined })).toThrow(
      MissingSecretError,
    );
    expect(() =>
      questionsConfig({ ...SECRETS, RATE_LIMIT_SALT: undefined, TURNSTILE_SECRET_KEY: undefined }),
    ).toThrow("Missing or invalid configuration value: rateLimitSalt, turnstileSecretKey");
    expect(() => questionsConfig({ ...SECRETS, PII_KEY_PRIMARY: "short" })).toThrow(
      "Missing or invalid configuration value: piiKeys.PRIMARY",
    );
    expect(() =>
      questionsConfig({
        ...SECRETS,
        PII_KEY_PRIMARY: undefined,
        PII_KEY_SECONDARY: "s".repeat(32),
      }),
    ).toThrow("PII_KEY_PRIMARY");
  });
});
