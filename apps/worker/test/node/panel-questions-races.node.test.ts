import { panelQuestionDetailSchema, panelQuestionsListSchema } from "@zsm3/contracts/questions";
import { describe, it } from "vitest";
import type { z } from "zod";

import { ANSWER, ORIGINAL, REDACTED, questionsPanel } from "./panel-questions-support.ts";
import { expectProblem, panelJsonCall } from "./panel-support.ts";

const draft = (version: number, answer = ANSWER) => ({
  expectedVersion: version,
  question: REDACTED,
  answer,
});
const decision = (action: string, version: number) => ({ action, expectedVersion: version });

async function read<T>(schema: z.ZodType<T>, response: Response): Promise<T> {
  return schema.parse(await response.json());
}

describe("two moderators at once", () => {
  it("lets only the first decision win and records only that one", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1));

    const [publish, reject] = await Promise.all([
      panel.call("POST", `/questions/${id}/decision`, decision("publish", 2)),
      panel.call("POST", `/questions/${id}/decision`, decision("reject", 2), "second"),
    ]);

    expect([publish.status, reject.status].toSorted((a, b) => a - b)).toEqual([200, 409]);
    expect((await panel.auditActions(id)).map(([action]) => action)).toHaveLength(2);
    const detail = await read(
      panelQuestionDetailSchema,
      await panel.call("GET", `/questions/${id}`),
    );
    expect(detail).toMatchObject({ version: 3 });
  });

  it("refuses a stale draft instead of overwriting the other answer", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1, "Odpowiedź A."), "second");

    const stale = await panel.call("PUT", `/questions/${id}/draft`, draft(1, "Odpowiedź B."));
    const detail = await read(
      panelQuestionDetailSchema,
      await panel.call("GET", `/questions/${id}`),
    );

    expect((await expectProblem(stale, 409)).title).toBe("Question Changed");
    expect(detail).toMatchObject({ version: 2, draft: { answer: "Odpowiedź A." } });
    expect(await panel.auditActions(id)).toEqual([
      ["questions.draft", "psycholog@zsm3.test", '{"fields":["draft"]}'],
    ]);
  });

  it("answers a conflict when the row moves between the read and the write", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    const db = panel.harness.env.DB;
    const harness = {
      ...panel.harness,
      env: {
        ...panel.harness.env,
        DB: {
          prepare: (query: string) => db.prepare(query),
          batch: async (statements: Parameters<typeof db.batch>[0]) => {
            await db
              .prepare("UPDATE questions SET version = version + 1 WHERE id = ?")
              .bind(id)
              .run();
            return db.batch(statements);
          },
        },
      },
    };
    const response = await panelJsonCall(harness, "POST", `/questions/${id}/decision`, {
      token: panel.tokens.counsellor,
      body: decision("reject", 1),
    });

    expect((await expectProblem(response, 409)).title).toBe("Question Changed");
    expect(await panel.auditActions(id)).toEqual([]);
  });
});

describe("listing and lookups", () => {
  it("pages the queue newest first and filters by status", async ({ expect }) => {
    const panel = await questionsPanel();
    const ids = [];
    for (let day = 1; day <= 21; day += 1) {
      ids.push(await panel.receive(ORIGINAL, `2026-09-${String(day).padStart(2, "0")}`));
    }
    await panel.call("POST", `/questions/${ids[0] ?? ""}/decision`, decision("reject", 1));

    const list = async (path: string) =>
      read(panelQuestionsListSchema, await panel.call("GET", path));
    const first = await list("/questions");
    const cursor = `before=${String(first.nextBefore)}&beforeId=${String(first.nextBeforeId)}`;
    const second = await list(`/questions?${cursor}`);
    const rejected = await list("/questions?status=rejected");

    expect(first.items).toHaveLength(20);
    expect(first.items[0]).toMatchObject({ receivedOn: "2026-09-21", status: "received" });
    expect(first.nextBefore).toBe("2026-09-02");
    expect(second).toEqual({
      items: [expect.objectContaining({ id: ids[0], status: "rejected" })],
      nextBefore: null,
      nextBeforeId: null,
    });
    expect(rejected.items.map((item) => item.id)).toEqual([ids[0]]);
  });

  it("offers no cursor when the queue holds exactly one page", async ({ expect }) => {
    const panel = await questionsPanel();
    for (let day = 1; day <= 20; day += 1) {
      await panel.receive(ORIGINAL, `2026-09-${String(day).padStart(2, "0")}`);
    }

    const list = await read(panelQuestionsListSchema, await panel.call("GET", "/questions"));

    expect([list.items.length, list.nextBefore, list.nextBeforeId]).toEqual([20, null, null]);
  });

  it("refuses malformed queries, ids and bodies", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();

    const responses = [
      await panel.call("GET", "/questions?status=new"),
      await panel.call("GET", "/questions?status=draft&status=received"),
      await panel.call("GET", "/questions/not-a-uuid"),
      await panel.call("GET", `/questions/${crypto.randomUUID()}`),
      await panel.call("PUT", `/questions/${id}/draft`, { expectedVersion: 1, question: "x" }),
      await panel.call("POST", `/questions/${id}/decision`, { action: "approve" }),
      await panel.call("POST", `/questions/${crypto.randomUUID()}/decision`, decision("reject", 1)),
      await panel.call("POST", `/questions/${id}/decision`, decision("reject", 7)),
    ];

    expect(responses.map((response) => response.status)).toEqual([
      422, 422, 404, 404, 422, 422, 404, 409,
    ]);
  });

  it("returns the moderation history with the newest entry first", async ({ expect }) => {
    const panel = await questionsPanel();
    const id = await panel.receive();
    await panel.call("PUT", `/questions/${id}/draft`, draft(1));
    await panel.call("PUT", `/questions/${id}/draft`, draft(2, "Druga wersja."), "second");

    const detail = await read(
      panelQuestionDetailSchema,
      await panel.call("GET", `/questions/${id}`),
    );

    expect(detail.history.map((entry) => [entry.action, entry.actorEmail])).toEqual([
      ["questions.draft", "psycholog@zsm3.test"],
      ["questions.draft", "pedagog@zsm3.test"],
    ]);
  });
});
