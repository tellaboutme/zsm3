import { describe, expect, it } from "vitest";

import {
  MAX_PANEL_PAGE_SIZE,
  MAX_SCHOOL_YEAR_EVENTS,
  PANEL_LIST_PAGE_SIZE,
  panelEventListSchema,
  panelEventSaveSchema,
  panelFileListSchema,
  panelListQuerySchema,
  panelMeSchema,
  panelMutationSchema,
  panelNewsListSchema,
  panelNewsMutationSchema,
  panelNewsViewSchema,
  panelOkSchema,
  panelPageListSchema,
  panelPageViewSchema,
  panelRedirectListSchema,
  panelRouteNameSchema,
  panelRouteNames,
  schoolYearLabel,
  schoolYearParamSchema,
  schoolYearRange,
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
const event = {
  date: "2026-09-01",
  title: "Rozpoczecie",
  audience: "Wszyscy" as const,
  kind: "wolne" as const,
};
const page = {
  path: "/kontakt",
  kicker: "K",
  title: "T",
  intro: "I",
  sections: [
    { id: "glowna", title: "S", blocks: [{ type: "rich-text" as const, document: [paragraph] }] },
  ],
};

describe("panel list queries", () => {
  it("applies defaults and clamps pagination", ({ expect }) => {
    expect(panelListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: PANEL_LIST_PAGE_SIZE,
      status: "all",
    });
    expect(panelListQuerySchema.parse({ page: "0", pageSize: "99999" })).toEqual({
      page: 1,
      pageSize: MAX_PANEL_PAGE_SIZE,
      status: "all",
    });
    expect(panelListQuerySchema.parse({ page: "30000", pageSize: "0" })).toEqual({
      page: 10000,
      pageSize: 1,
      status: "all",
    });
    expect(
      panelListQuerySchema.parse({ status: "draft", category: " Techn ", year: "2026" }),
    ).toMatchObject({
      status: "draft",
      category: "Techn",
      year: "2026",
    });
    rejects(panelListQuerySchema, { page: "nan" });
    rejects(panelListQuerySchema, { year: "26" });
    rejects(panelListQuerySchema, { category: "" });
    rejects(panelListQuerySchema, { extra: true });
  });

  it("turns an anchor year into the school year span", ({ expect }) => {
    expect(schoolYearRange(2026)).toEqual(["2026-08-01", "2027-07-31"]);
    expect(schoolYearLabel(2026)).toBe("2026/2027");
    expect(schoolYearParamSchema.parse("2026")).toBe(2026);
    rejects(schoolYearParamSchema, "abc");
  });
});

describe("news envelopes and mutations", () => {
  it("lists news items with publication status and totals", ({ expect }) => {
    const item = { ...news, status: "draft" as const };
    const list = { items: [item], total: 1, page: 3, pageSize: 25 };

    expect(panelNewsListSchema.parse(list)).toEqual(list);
    expect(panelNewsViewSchema.parse({ item }).item.status).toBe("draft");
    rejects(panelNewsListSchema, { items: [item], total: -1, page: 1, pageSize: 20 });
    rejects(panelNewsListSchema, { items: [item], total: 1, page: 0, pageSize: 20 });
    rejects(panelNewsListSchema, {
      items: [item],
      total: 1,
      page: 1,
      pageSize: MAX_PANEL_PAGE_SIZE + 1,
    });
    rejects(panelNewsViewSchema, { item: { ...item, status: "scheduled" } });
    rejects(panelNewsViewSchema, { item: { ...item, extra: 1 } });
  });

  it("maps news mutations by action", ({ expect }) => {
    expect(panelNewsMutationSchema.parse({ action: "save", item: news })).toEqual({
      action: "save",
      item: news,
    });
    expect(panelNewsMutationSchema.parse({ action: "publish" })).toEqual({ action: "publish" });
    expect(panelNewsMutationSchema.parse({ action: "unpublish" })).toEqual({ action: "unpublish" });
    rejects(panelNewsMutationSchema, { action: "delete" });
    rejects(panelNewsMutationSchema, { action: "save" });
  });
});

describe("panel mutation table", () => {
  it("discriminates mutations by entity", ({ expect }) => {
    expect(panelMutationSchema.parse({ entity: "news", mutation: { action: "publish" } })).toEqual({
      entity: "news",
      mutation: { action: "publish" },
    });
    expect(
      panelMutationSchema.parse({ entity: "pages", action: "save", page, status: "draft" }),
    ).toEqual({
      entity: "pages",
      action: "save",
      page,
      status: "draft",
    });
    expect(panelMutationSchema.parse({ entity: "events", events: [event] })).toEqual({
      entity: "events",
      events: [event],
    });
    expect(
      panelMutationSchema.parse({ entity: "redirects", item: { from: "/stara", to: "/nowa" } }),
    ).toEqual({
      entity: "redirects",
      item: { from: "/stara", to: "/nowa" },
    });
    rejects(panelMutationSchema, { entity: "staff", events: [] });
    rejects(panelMutationSchema, { entity: "pages", action: "delete", page, status: "draft" });
  });
});

describe("pages, events, files and redirects envelopes", () => {
  it("describes page listings and saved pages", ({ expect }) => {
    const pageItem = { ...page, status: "published" as const };

    expect(
      panelPageListSchema.parse({ items: [{ path: "/kontakt", status: "draft", title: "T" }] }),
    ).toEqual({
      items: [{ path: "/kontakt", status: "draft", title: "T" }],
    });
    expect(panelPageViewSchema.parse({ item: pageItem }).item.status).toBe("published");
    rejects(panelPageListSchema, { items: [{ path: "kontakt", status: "draft", title: "T" }] });
    rejects(panelPageViewSchema, { item: { ...pageItem, status: "archived" } });
  });

  it("describes event listings and saves", ({ expect }) => {
    expect(panelEventListSchema.parse({ items: [event] })).toEqual({ items: [event] });
    expect(panelEventSaveSchema.parse({ events: [event] })).toEqual({ events: [event] });
    expect(panelEventListSchema.safeParse({ items: [] }).success).toBe(true);
    expect(panelEventSaveSchema.parse({ events: [] })).toEqual({ events: [] });
    rejects(panelEventSaveSchema, {
      events: [...Array.from({ length: MAX_SCHOOL_YEAR_EVENTS + 1 }, () => event)],
    });
    rejects(panelEventListSchema, { items: [{ ...event, kind: "strajk" }] });
  });

  it("describes file and redirect listings", ({ expect }) => {
    const stored = {
      key: `d/${"0123456789abcdef".repeat(4)}.pdf`,
      name: "a.pdf",
      format: "pdf" as const,
      bytes: 9,
    };

    expect(panelFileListSchema.parse({ items: [stored] })).toEqual({ items: [stored] });
    rejects(panelFileListSchema, { items: [{ ...stored, bytes: 0 }] });
    expect(panelRedirectListSchema.parse({ items: [{ from: "/a", to: "/b" }] })).toEqual({
      items: [{ from: "/a", to: "/b" }],
    });
    rejects(panelRedirectListSchema, { items: [{ from: "/a", to: "/a" }] });
  });

  it("answers session and acknowledgement envelopes", ({ expect }) => {
    expect(panelMeSchema.parse({ email: "Admin@ZSM3.pl ", role: "admin" })).toEqual({
      email: "admin@zsm3.pl",
      role: "admin",
    });
    rejects(panelMeSchema, { email: "admin@zsm3.pl", role: "dyrektor" });
    expect(panelOkSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(panelRouteNameSchema.parse("news.list")).toBe("news.list");
    expect(panelRouteNameSchema.options).toEqual([...panelRouteNames]);
    rejects(panelRouteNameSchema, "staff.delete");
  });
});
