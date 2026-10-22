import { describe, it } from "vitest";

import { newsSchema, schoolEventSchema, sitePathSchema, slugSchema } from "../src/content.ts";

const body = [{ type: "paragraph", content: [{ type: "text", text: "Treść." }] }];

const news = {
  slug: "dzien-patrona",
  date: "2026-10-23",
  category: "Uroczystości",
  title: "Dzień Patrona",
  lead: "Harmonogram uroczystości.",
  body,
};

describe("slugs and paths", () => {
  it("accept lowercase hyphenated slugs only", ({ expect }) => {
    for (const slug of ["a", "dzien-patrona", "salon-2026"]) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(true);
    }
    for (const slug of ["", "-a", "a-", "a--b", "Dzien", "dzień", "a b", "a/b", "x".repeat(121)]) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false);
    }
  });

  it("accept site paths only", ({ expect }) => {
    for (const path of [
      "/",
      "/kontakt",
      "/szkola/historia",
      "/aktualnosci/2026/salon-2026",
      "/rada-rodzicow/sklad",
    ]) {
      expect(sitePathSchema.safeParse(path).success, path).toBe(true);
    }
    for (const path of [
      "",
      "kontakt",
      "//x",
      "/x/",
      "/X",
      "/a//b",
      "https://x.pl",
      "/a?b",
      "/a-!",
      "/a-/b",
    ]) {
      expect(sitePathSchema.safeParse(path).success, path).toBe(false);
    }
  });
});

describe("news", () => {
  it("accepts a complete item with an optional cover", ({ expect }) => {
    expect(newsSchema.safeParse(news).success).toBe(true);
    expect(
      newsSchema.safeParse({ ...news, cover: { caption: "Apel", credit: "ZSM3" } }).success,
    ).toBe(true);
  });

  it("rejects bad dates, empty text and unknown fields", ({ expect }) => {
    for (const change of [
      { date: "2026-13-01" },
      { date: "23.10.2026" },
      { title: "   " },
      { lead: "x".repeat(501) },
      { body: [] },
      { html: "<b>x</b>" },
    ]) {
      expect(newsSchema.safeParse({ ...news, ...change }).success, JSON.stringify(change)).toBe(
        false,
      );
    }
  });
});

describe("events", () => {
  const event = { date: "2026-12-23", title: "Przerwa", audience: "Wszyscy", kind: "przerwa" };

  it("knows every audience and kind", ({ expect }) => {
    for (const audience of ["Wszyscy", "Uczniowie", "Rodzice"]) {
      expect(schoolEventSchema.safeParse({ ...event, audience }).success, audience).toBe(true);
    }
    for (const kind of [
      "rok-szkolny",
      "przerwa",
      "wolne",
      "zebranie",
      "uroczystosc",
      "oceny",
      "egzamin",
      "praktyki",
    ]) {
      expect(schoolEventSchema.safeParse({ ...event, kind }).success, kind).toBe(true);
    }
  });

  it("accepts single and multi-day events", ({ expect }) => {
    expect(schoolEventSchema.safeParse(event).success).toBe(true);
    expect(
      schoolEventSchema.safeParse({ ...event, endDate: "2026-12-31", key: true }).success,
    ).toBe(true);
  });

  it("rejects an end before the start and unknown kinds or audiences", ({ expect }) => {
    const reversed = schoolEventSchema.safeParse({ ...event, endDate: "2026-12-23" });

    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]?.message).toBe("The end date must be after the start date");
    expect(reversed.error?.issues[0]?.path).toEqual(["endDate"]);
    expect(schoolEventSchema.safeParse({ ...event, kind: "sport" }).success).toBe(false);
    expect(schoolEventSchema.safeParse({ ...event, audience: "Nauczyciele" }).success).toBe(false);
    expect(schoolEventSchema.safeParse({ ...event, key: false }).success).toBe(false);
  });
});
