import { panelQuestionDetailSchema, panelQuestionWriteSchema } from "@zsm3/contracts/questions";
import { describe, it } from "vitest";
import type { z } from "zod";

import { ANSWER, decision, ORIGINAL, questionsPanel, REDACTED } from "./panel-questions-support.ts";
import { expectProblem } from "./panel-support.ts";

const draft = (version: number, answer = ANSWER) => ({
  expectedVersion: version,
  question: REDACTED,
  answer,
});

async function read<T>(schema: z.ZodType<T>, response: Response): Promise<T> {
  return schema.parse(await response.json());
}

describe("moderating a question", () => {
  it("shows the decrypted question only to the counsellor", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();

    const shown = await panel.call("GET", `/questions/${id}`);
    const denied = await panel.call("GET", `/questions/${id}`, undefined, "admin");

    expect(await read(panelQuestionDetailSchema, shown)).toEqual({
      id,
      addressee: "pedagogue",
      status: "received",
      version: 1,
      receivedOn: "2026-10-20",
      question: ORIGINAL,
      unreadable: [],
      draft: null,
      published: null,
      history: [],
    });
    await expectProblem(denied, 403);
  });

  it("publishes only the redacted draft and erases the original", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();

    const saved = await panel.call("PUT", `/questions/${id}/draft`, draft(1));
    const published = await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    const detail = await read(
      panelQuestionDetailSchema,
      await panel.call("GET", `/questions/${id}`),
    );
    const listed = await panel.repo.published(10, 0);

    expect([
      await read(panelQuestionWriteSchema, saved),
      await read(panelQuestionWriteSchema, published),
    ]).toEqual([
      { ok: true, version: 2 },
      { ok: true, version: 3 },
    ]);
    expect(detail).toMatchObject({
      status: "published",
      version: 3,
      question: null,
      draft: { question: REDACTED, answer: ANSWER },
    });
    expect(listed[0]?.slug).toMatch(/^[a-z2-9]{12}$/u);
    expect(
      listed.map((item) => ({
        addressee: item.addressee,
        question: item.question,
        answer: item.answer,
        publishedOn: item.publishedOn,
      })),
    ).toEqual([
      {
        addressee: "pedagogue",
        question: REDACTED,
        answer: ANSWER,
        publishedOn: new Date().toISOString().slice(0, 10),
      },
    ]);
    expect(JSON.stringify(listed)).not.toContain("Przykładow");
    expect(await panel.auditActions(id)).toEqual([
      ["questions.draft", "pedagog@zsm3.test", '{"fields":["draft"]}'],
      ["questions.publish", "pedagog@zsm3.test", '{"fields":["status","published"]}'],
    ]);
  });

  it("withdraws a publication and republishes it under the same address", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1));
    await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));
    const [first] = await panel.repo.published(10, 0);

    await panel.call("POST", `/questions/${id}/decision`, decision("withdraw", 3));
    const hidden = await panel.repo.publishedBySlug(first?.slug ?? "");
    const count = await panel.repo.publishedCount();
    await panel.call("PUT", `/questions/${id}/draft`, draft(4, "Poprawiona odpowiedź."));
    await panel.call("POST", `/questions/${id}/decision`, decision("publish", 5));
    const again = await panel.repo.publishedBySlug(first?.slug ?? "");

    expect([hidden, count]).toEqual([undefined, 0]);
    expect(again).toMatchObject({ slug: first?.slug, answer: "Poprawiona odpowiedź." });
  });

  it("refuses to publish without an answer or straight from the queue", async ({ expect }) => {
    const panel = await questionsPanel();
    const queued = await panel.receive();
    const empty = await panel.receive();
    await panel.call("PUT", `/questions/${empty}/draft`, draft(1, "   "));

    const fromQueue = await panel.call(
      "POST",
      `/questions/${queued}/decision`,
      decision("publish", 1),
    );
    const noAnswer = await panel.call(
      "POST",
      `/questions/${empty}/decision`,
      decision("publish", 2),
    );

    expect((await expectProblem(fromQueue, 422)).title).toBe("Invalid Question Transition");
    expect((await expectProblem(noAnswer, 422)).title).toBe("Answer Required");
    expect(await panel.repo.publishedCount()).toBe(0);
  });

  it("rejects, then deletes, and refuses moves the lifecycle forbids", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();

    const rejected = await panel.call("POST", `/questions/${id}/decision`, decision("reject", 1));
    const redraft = await panel.call("PUT", `/questions/${id}/draft`, draft(2));
    const withdraw = await panel.call("POST", `/questions/${id}/decision`, decision("withdraw", 2));
    const deleted = await panel.call("POST", `/questions/${id}/decision`, decision("delete", 2));
    const gone = await panel.call("GET", `/questions/${id}`);

    expect(rejected.status).toBe(200);
    await expectProblem(redraft, 422);
    await expectProblem(withdraw, 422);
    expect(await read(panelQuestionWriteSchema, deleted)).toEqual({ ok: true, version: null });
    await expectProblem(gone, 404);
    expect((await panel.auditActions(id)).map(([action]) => action)).toEqual([
      "questions.reject",
      "questions.delete",
    ]);
  });

  it("does not delete a published question until it is withdrawn", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1));
    await panel.call("POST", `/questions/${id}/decision`, decision("publish", 2));

    const deleted = await panel.call("POST", `/questions/${id}/decision`, decision("delete", 3));
    const edited = await panel.call("PUT", `/questions/${id}/draft`, draft(3));

    await expectProblem(deleted, 422);
    await expectProblem(edited, 422);
    expect(await panel.repo.publishedCount()).toBe(1);
  });
});
