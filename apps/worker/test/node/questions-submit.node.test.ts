import { describe, it } from "vitest";

import {
  everyStoredText,
  NOW,
  QUESTION,
  questionBody,
  questionHarness,
  questionInput,
  storedRows,
} from "./questions-harness.ts";
import { unseal } from "../../src/questions/sealing.ts";
import {
  QUESTION_ACCEPTED_LIMIT,
  QUESTION_ATTEMPT_LIMIT,
  submitQuestion,
  windowStart,
} from "../../src/questions/submit.ts";

describe("an anonymous question", () => {
  it("is stored encrypted, dated to the day and never published", async ({ expect }) => {
    const harness = questionHarness();

    const outcome = await submitQuestion(harness.deps, questionInput(questionBody()));

    const [row] = storedRows(harness.db);
    const record = await harness.repo.find(String(row?.["id"]));
    expect(outcome).toEqual({ kind: "received" });
    expect(row).toMatchObject({
      addressee: "psychologist",
      status: "received",
      version: 1,
      received_on: "2026-10-22",
      changed_at: null,
      draft_ciphertext: null,
      public_slug: null,
      published_question: null,
      published_answer: null,
      published_on: null,
      question_key_id: "PRIMARY",
    });
    expect(String(row?.["id"])).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/u);
    expect(everyStoredText(harness.db)).not.toContain(QUESTION);
    expect(record?.question).not.toBeNull();
    expect(
      record?.question === null || record === undefined
        ? undefined
        : await unseal(harness.crypto, "question", record.id, record.question),
    ).toBe(QUESTION);
    expect(await harness.repo.published(10, 0)).toEqual([]);
  });

  it("keeps no trace of the sender's address or the exact time", async ({ expect }) => {
    const harness = questionHarness();

    await submitQuestion(harness.deps, questionInput(questionBody(), "198.51.100.23"));

    expect(everyStoredText(harness.db)).not.toContain("198.51.100.23");
    expect(JSON.stringify(storedRows(harness.db))).not.toContain("08:00");
    expect(harness.verifications.map((body) => body.has("remoteip"))).toEqual([false]);
    expect(harness.verifications.map((body) => body.get("response"))).toEqual(["tok"]);
  });

  it("is stored once when the same form is sent twice", async ({ expect }) => {
    const harness = questionHarness();
    const body = questionBody();

    const first = await submitQuestion(harness.deps, questionInput(body));
    const second = await submitQuestion(harness.deps, questionInput(body));

    expect([first, second]).toEqual([{ kind: "received" }, { kind: "received" }]);
    expect(storedRows(harness.db)).toHaveLength(1);
  });

  it("counts only verified, well-formed questions against the accepted quota", async ({
    expect,
  }) => {
    const harness = questionHarness();
    const outcomes = [];
    for (let attempt = 0; attempt <= QUESTION_ACCEPTED_LIMIT; attempt += 1) {
      outcomes.push(await submitQuestion(harness.deps, questionInput(questionBody())));
    }
    const other = await submitQuestion(harness.deps, questionInput(questionBody(), "192.0.2.9"));

    expect(outcomes.at(-1)).toEqual({ kind: "refused", reason: "rate_limit" });
    expect(outcomes.slice(0, QUESTION_ACCEPTED_LIMIT)).toEqual(
      Array.from({ length: QUESTION_ACCEPTED_LIMIT }, () => ({ kind: "received" })),
    );
    expect(other).toEqual({ kind: "received" });
    expect(storedRows(harness.db)).toHaveLength(QUESTION_ACCEPTED_LIMIT + 1);
  });

  it("does not let invalid attempts use up the accepted quota", async ({ expect }) => {
    const harness = questionHarness();
    for (let attempt = 0; attempt < QUESTION_ATTEMPT_LIMIT - 1; attempt += 1) {
      await submitQuestion(harness.deps, questionInput(questionBody({ honeypot: "bot" })));
    }

    const valid = await submitQuestion(harness.deps, questionInput(questionBody()));

    expect(valid).toEqual({ kind: "received" });
  });

  it("caps every attempt per window before verifying and resets in the next", async ({
    expect,
  }) => {
    const harness = questionHarness();
    const previous = new Date(NOW.getTime() - 1);
    for (let attempt = 0; attempt < QUESTION_ATTEMPT_LIMIT; attempt += 1) {
      await submitQuestion(harness.deps, {
        ...questionInput({ turnstileToken: "tok" }),
        now: previous,
      });
    }
    const capped = await submitQuestion(harness.deps, {
      ...questionInput(questionBody()),
      now: previous,
    });
    const next = await submitQuestion(harness.deps, questionInput(questionBody()));

    expect(capped).toEqual({ kind: "refused", reason: "rate_limit" });
    expect(harness.verifications).toHaveLength(QUESTION_ATTEMPT_LIMIT + 1);
    expect(next).toEqual({ kind: "received" });
  });

  it("keeps only window-aligned counters without the address", async ({ expect }) => {
    const harness = questionHarness();
    const now = new Date("2026-10-22T08:01:07.412Z");

    await submitQuestion(harness.deps, { ...questionInput(questionBody(), "198.51.100.23"), now });

    const counters = harness.db.sqlite.prepare("SELECT * FROM rate_limits").all();
    expect(counters.map((row) => row["window_started_at"])).toEqual([
      "2026-10-22T08:00:00.000Z",
      "2026-10-22T08:00:00.000Z",
    ]);
    expect(JSON.stringify(counters)).not.toContain("198.51.100.23");
    expect(windowStart(new Date("2026-10-22T08:09:59.999Z")).toISOString()).toBe(
      "2026-10-22T08:00:00.000Z",
    );
  });

  it("refuses a failed, foreign or reused challenge", async ({ expect }) => {
    const refusals = [];
    for (const reply of [{ success: false }, { action: "request" }, { hostname: "evil.test" }]) {
      const harness = questionHarness(reply);
      refusals.push(await submitQuestion(harness.deps, questionInput(questionBody())));
      expect(storedRows(harness.db)).toEqual([]);
    }

    expect(refusals).toEqual(
      Array.from({ length: 3 }, () => ({ kind: "refused", reason: "turnstile" })),
    );
  });

  it("refuses bodies without a token or with invalid or unknown fields", async ({ expect }) => {
    const harness = questionHarness();
    let sender = 0;
    const submit = async (body: unknown) => {
      sender += 1;
      return submitQuestion(harness.deps, questionInput(body, `192.0.2.${String(sender)}`));
    };

    const outcomes = [
      await submit({ ...questionBody(), turnstileToken: undefined }),
      await submit("tekst"),
      await submit(questionBody({ question: "Za krótko" })),
      await submit(questionBody({ honeypot: "bot" })),
      await submit(questionBody({ email: "uczen@example.com" })),
      await submit(questionBody({ submittedAtMs: NOW.getTime() - 60_000 })),
    ];

    expect(outcomes).toEqual(
      Array.from({ length: 6 }, () => ({ kind: "refused", reason: "invalid" })),
    );
    expect(storedRows(harness.db)).toEqual([]);
  });

  it("stores markup as plain text without interpreting it", async ({ expect }) => {
    const harness = questionHarness();
    const markup = '<img src=x onerror="alert(1)"> <svg onload=alert(2)>';

    await submitQuestion(harness.deps, questionInput(questionBody({ question: markup })));

    const [row] = storedRows(harness.db);
    const record = await harness.repo.find(String(row?.["id"]));
    expect(
      record?.question === null || record === undefined
        ? undefined
        : await unseal(harness.crypto, "question", record.id, record.question),
    ).toBe(markup);
  });
});
