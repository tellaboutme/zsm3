import { panelQuestionDetailSchema } from "@zsm3/contracts/questions";
import { afterEach, describe, it, vi } from "vitest";

import {
  ANSWER,
  decision,
  ORIGINAL,
  questionsPanel,
  REDACTED,
  type QuestionsPanel,
} from "./panel-questions-support.ts";
import { expectProblem, panelJsonCall } from "./panel-support.ts";
import { seal } from "../../src/questions/sealing.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

const OLD_KEY = "o".repeat(32);

afterEach(() => {
  vi.restoreAllMocks();
});

async function drafted(panel: QuestionsPanel, question = REDACTED): Promise<string> {
  const id = await panel.receive();
  await panel.call("PUT", `/questions/${id}/draft`, {
    expectedVersion: 1,
    question,
    answer: ANSWER,
  });
  return id;
}

async function receiveSealedWith(
  panel: QuestionsPanel,
  sealer: (id: string) => Promise<{ readonly ciphertext: Uint8Array; readonly keyId: string }>,
): Promise<string> {
  const id = globalThis.crypto.randomUUID();
  await panel.repo.receive({
    id,
    addressee: "pedagogue",
    question: await sealer(id),
    formKey: globalThis.crypto.randomUUID(),
    receivedOn: "2026-10-20",
  });
  return id;
}

describe("publishing a question needs a privacy review", () => {
  it("refuses a publication without the acknowledgment", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await drafted(panel);
    const path = `/questions/${id}/decision`;

    const missing = await panel.call("POST", path, { action: "publish", expectedVersion: 2 });
    const declined = await panel.call("POST", path, {
      action: "publish",
      expectedVersion: 2,
      privacyReviewed: false,
    });
    const stray = await panel.call("POST", path, {
      ...decision("reject", 2),
      privacyReviewed: true,
    });

    await expectProblem(missing, 422);
    await expectProblem(declined, 422);
    await expectProblem(stray, 422);
    expect(await panel.repo.publishedCount()).toBe(0);
  });

  it("refuses a draft that only repeats the original", async ({ expect }) => {
    const panel = await questionsPanel();
    const echoed = ` ${ORIGINAL.toUpperCase().replaceAll(" ", "  \n")} `;
    const id = await drafted(panel, echoed);

    const refused = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));

    expect((await expectProblem(refused, 422)).title).toBe("Draft Matches Original");
    expect(await panel.repo.publishedCount()).toBe(0);
  });

  it("ties the acknowledgment to the version that was reviewed", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await drafted(panel);
    await panel.call("PUT", `/questions/${id}/draft`, {
      expectedVersion: 2,
      question: ORIGINAL.replace("9Z", "9Y"),
      answer: ANSWER,
    });

    const stale = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));

    expect((await expectProblem(stale, 409)).title).toBe("Question Changed");
    expect(await panel.repo.publishedCount()).toBe(0);
  });
});

describe("a question sealed with an unavailable key", () => {
  it("stays stored, is reported without content and cannot be published", async ({ expect }) => {
    const panel = await questionsPanel();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const old = piiCrypto({ SECONDARY: OLD_KEY }, "SECONDARY", cryptoRandom);
    const id = await receiveSealedWith(panel, async (target) =>
      seal(old, "question", target, ORIGINAL),
    );

    const shown = panelQuestionDetailSchema.parse(
      await (await panel.call("GET", `/questions/${id}`)).json(),
    );
    const restored = {
      ...panel.harness,
      env: { ...panel.harness.env, PII_KEY_SECONDARY: OLD_KEY },
    };
    const reopened = panelQuestionDetailSchema.parse(
      await (
        await panelJsonCall(restored, "GET", `/questions/${id}`, { token: panel.tokens.counsellor })
      ).json(),
    );

    expect(shown).toMatchObject({ status: "received", question: null, unreadable: ["question"] });
    expect(logged.mock.calls.map(([line]) => String(line))).toEqual([
      '{"event":"question_unreadable","part":"question","keyId":"SECONDARY"}',
    ]);
    expect(reopened).toMatchObject({ question: ORIGINAL, unreadable: [] });
  });

  it("treats corrupted or misbound ciphertext the same way", async ({ expect }) => {
    const panel = await questionsPanel();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const corrupted = await receiveSealedWith(panel, async (target) => {
      const sealed = await seal(panel.crypto, "question", target, ORIGINAL);
      const bytes = Uint8Array.from(sealed.ciphertext);
      bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
      return { ciphertext: bytes, keyId: sealed.keyId };
    });
    const misbound = await receiveSealedWith(panel, async () =>
      seal(panel.crypto, "question", globalThis.crypto.randomUUID(), ORIGINAL),
    );

    for (const id of [corrupted, misbound]) {
      const shown = panelQuestionDetailSchema.parse(
        await (await panel.call("GET", `/questions/${id}`)).json(),
      );
      expect(shown).toMatchObject({ question: null, unreadable: ["question"] });
    }
  });

  it("refuses to publish when the original cannot be compared", async ({ expect }) => {
    const panel = await questionsPanel();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const old = piiCrypto({ SECONDARY: OLD_KEY }, "SECONDARY", cryptoRandom);
    const id = await receiveSealedWith(panel, async (target) =>
      seal(old, "question", target, ORIGINAL),
    );
    await panel.call("PUT", `/questions/${id}/draft`, {
      expectedVersion: 1,
      question: REDACTED,
      answer: ANSWER,
    });

    const refused = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    const shown = panelQuestionDetailSchema.parse(
      await (await panel.call("GET", `/questions/${id}`)).json(),
    );

    expect((await expectProblem(refused, 422)).title).toBe("Question Unreadable");
    expect(shown).toMatchObject({ status: "draft", unreadable: ["question"] });
    expect(shown.draft).toEqual({ question: REDACTED, answer: ANSWER });
  });

  it("reports an unreadable draft and refuses to publish it", async ({ expect }) => {
    const panel = await questionsPanel();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = await panel.receive();
    const rotated = {
      ...panel.harness,
      env: { ...panel.harness.env, PII_KEY_PRIMARY: "b".repeat(32) },
    };
    await panelJsonCall(rotated, "PUT", `/questions/${id}/draft`, {
      token: panel.tokens.counsellor,
      body: { expectedVersion: 1, question: REDACTED, answer: ANSWER },
    });

    const shown = panelQuestionDetailSchema.parse(
      await (await panel.call("GET", `/questions/${id}`)).json(),
    );
    const refused = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));

    expect(shown).toMatchObject({ status: "draft", question: ORIGINAL, draft: null });
    expect(shown.unreadable).toEqual(["draft"]);
    expect((await expectProblem(refused, 422)).title).toBe("Question Unreadable");
  });
});
