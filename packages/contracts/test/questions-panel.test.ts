import { describe, it } from "vitest";

import { panelQuestionsListSchema, panelQuestionWriteSchema } from "../src/questions.ts";

describe("panel responses", () => {
  it("bounds a list page and requires a successful write", ({ expect }) => {
    const item = {
      id: "0191e4a0-0000-4000-8000-000000000000",
      addressee: "pedagogue",
      status: "received",
      version: 1,
      receivedOn: "2026-10-20",
    };
    const page = (count: number) => ({
      items: Array.from({ length: count }, () => item),
      nextBefore: null,
      nextBeforeId: null,
    });
    expect(panelQuestionsListSchema.safeParse(page(0)).success).toBe(true);
    expect(panelQuestionsListSchema.safeParse(page(20)).success).toBe(true);
    expect(panelQuestionsListSchema.safeParse(page(21)).success).toBe(false);
    expect(panelQuestionWriteSchema.parse({ ok: true, version: 2 })).toEqual({
      ok: true,
      version: 2,
    });
    expect(panelQuestionWriteSchema.parse({ ok: true, version: null }).version).toBeNull();
    expect(panelQuestionWriteSchema.safeParse({ ok: false, version: 2 }).success).toBe(false);
  });
});
