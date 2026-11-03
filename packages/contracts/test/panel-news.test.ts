import { describe, expect, it } from "vitest";

import {
  MAX_PANEL_PAGE_SIZE,
  panelNewsListSchema,
  panelNewsMutationSchema,
  panelNewsViewSchema,
} from "../src/panel.ts";

interface Parsed {
  readonly success: boolean;
}

const rejects = (
  schema: { readonly safeParse: (value: unknown) => Parsed },
  value: unknown,
): void => {
  expect(schema.safeParse(value).success).toBe(false);
};

const paragraph = { type: "paragraph" as const, content: [{ type: "text" as const, text: "T." }] };
const news = {
  slug: "salon",
  date: "2026-09-01",
  category: "Technikum",
  title: "Salon",
  lead: "Lead.",
  body: [paragraph],
};

describe("news envelopes and mutations", () => {
  it("lists news items with publication status and totals", ({ expect }) => {
    const item = { ...news, status: "draft" as const };
    const list = { items: [item], total: 1, page: 3, pageSize: 25 };

    expect(panelNewsListSchema.parse(list)).toEqual(list);
    expect(panelNewsViewSchema.parse({ item, revision: 0 }).item.status).toBe("draft");
    rejects(panelNewsViewSchema, { item });
    rejects(panelNewsViewSchema, { item, revision: -1 });
    rejects(panelNewsViewSchema, { item, revision: 1.5 });
    rejects(panelNewsListSchema, { items: [item], total: -1, page: 1, pageSize: 20 });
    rejects(panelNewsListSchema, { items: [item], total: 1, page: 0, pageSize: 20 });
    rejects(panelNewsListSchema, {
      items: [item],
      total: 1,
      page: 1,
      pageSize: MAX_PANEL_PAGE_SIZE + 1,
    });
    rejects(panelNewsViewSchema, { item: { ...item, status: "scheduled" }, revision: 0 });
    rejects(panelNewsViewSchema, { item: { ...item, extra: 1 }, revision: 0 });
  });

  it("maps news mutations by action", ({ expect }) => {
    expect(
      panelNewsMutationSchema.parse({ action: "save", item: news, expectedRevision: null }),
    ).toEqual({ action: "save", item: news, expectedRevision: null });
    expect(
      panelNewsMutationSchema.parse({ action: "save", item: news, expectedRevision: 7 }),
    ).toEqual({ action: "save", item: news, expectedRevision: 7 });
    expect(panelNewsMutationSchema.parse({ action: "publish", expectedRevision: 0 })).toEqual({
      action: "publish",
      expectedRevision: 0,
    });
    expect(panelNewsMutationSchema.parse({ action: "unpublish", expectedRevision: 2 })).toEqual({
      action: "unpublish",
      expectedRevision: 2,
    });
    rejects(panelNewsMutationSchema, { action: "delete" });
    rejects(panelNewsMutationSchema, { action: "save", expectedRevision: null });
    rejects(panelNewsMutationSchema, { action: "save", item: news });
    rejects(panelNewsMutationSchema, { action: "publish" });
    rejects(panelNewsMutationSchema, { action: "publish", expectedRevision: null });
    rejects(panelNewsMutationSchema, { action: "unpublish", expectedRevision: -1 });
  });
});
