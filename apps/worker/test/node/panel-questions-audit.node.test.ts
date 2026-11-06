import { afterEach, describe, it, vi } from "vitest";

import { ANSWER, decision, ORIGINAL, questionsPanel, REDACTED } from "./panel-questions-support.ts";
import { panelRawCall } from "./panel-support.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { questionsRepo } from "../../src/storage/questions-repo.ts";

const draft = (version: number) => ({
  expectedVersion: version,
  question: REDACTED,
  answer: ANSWER,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Skrzynka panel under attack", () => {
  it("never announces a publication or a withdrawal to IndexNow", async ({ expect }) => {
    const submitted: (readonly string[])[] = [];
    const panel = await questionsPanel({
      submit: async (urls) => {
        submitted.push(urls);
        return Promise.resolve(true);
      },
    });
    const id = await panel.receive();

    await panel.call("PUT", `/questions/${id}/draft`, draft(1));
    await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    await panel.call("POST", `/questions/${id}/decision`, decision("withdraw", 3));

    expect(submitted).toEqual([]);
  });

  it("refuses requests without a session, from another site or without JSON", async ({
    expect,
  }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    const token = panel.tokens.counsellor;
    const body = JSON.stringify(decision("reject", 1));

    const statuses = [
      (await panelRawCall(panel.harness, "GET", "/questions", { headers: {} })).status,
      (await panelRawCall(panel.harness, "GET", `/questions/${id}`, { headers: {} })).status,
      (
        await panelRawCall(panel.harness, "POST", `/questions/${id}/decision`, {
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            origin: "https://evil.test",
          },
          body,
        })
      ).status,
      (
        await panelRawCall(panel.harness, "PUT", `/questions/${id}/draft`, {
          headers: {
            authorization: `Bearer ${token}`,
            origin: "https://panel.zsm3.test",
            "content-type": "text/plain",
          },
          body: JSON.stringify(draft(1)),
        })
      ).status,
    ];

    expect(statuses).toEqual([401, 401, 403, 403]);
    expect((await panel.repo.find(id))?.status).toBe("received");
  });

  it("keeps moderation working while the public box is switched off", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();

    expect(Reflect.get(panel.harness.env, "SKRZYNKA_ENABLED")).toBeUndefined();
    expect((await panel.call("GET", `/questions/${id}`)).status).toBe(200);
  });

  it("never echoes the student's text in problems or logs", async ({ expect }) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const panel = await questionsPanel();
    const id = await panel.receive();
    const foreign = piiCrypto({ PRIMARY: "z".repeat(32) }, "PRIMARY", cryptoRandom);
    const other = globalThis.crypto.randomUUID();
    await questionsRepo(panel.store).receive({
      id: other,
      addressee: "leadership",
      question: await foreign.encrypt(ORIGINAL, `question:${other}`),
      formKey: other,
      receivedOn: "2026-10-21",
    });

    const responses = [
      await panel.call("POST", `/questions/${id}/decision`, decision("publish", 1)),
      await panel.call("POST", `/questions/${id}/decision`, decision("reject", 9)),
      await panel.call("PUT", `/questions/${id}/draft`, {
        expectedVersion: 1,
        question: "x",
        answer: "",
      }),
      await panel.call("GET", `/questions/${other}`),
    ];
    const bodies = await Promise.all(responses.map(async (response) => response.text()));

    expect(responses.map((response) => response.status)).toEqual([422, 409, 422, 200]);
    expect(bodies.join(" ")).not.toContain("Przykładow");
    expect(logged.mock.calls.flat().join(" ")).not.toContain("Przykładow");
    expect(logged.mock.calls.flat().join(" ")).not.toContain(other);
    expect(logged.mock.calls.flat().join(" ")).toContain('"event":"question_unreadable"');
  });

  it("publishes a question only once", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1));

    const first = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    const stale = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    const again = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 3));

    expect([first.status, stale.status, again.status]).toEqual([200, 409, 422]);
    expect(await panel.repo.publishedCount()).toBe(1);
    expect((await panel.auditActions(id)).map(([action]) => action)).toEqual([
      "questions.draft",
      "questions.publish",
    ]);
  });
});
