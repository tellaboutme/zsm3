import { describe, it, vi } from "vitest";

import {
  latestNews,
  loadArticle,
  loadListing,
  RELATED_COUNT,
  type NewsReader,
} from "../src/lib/news-listing.ts";
import type { NewsItem } from "../src/lib/news.ts";

function item(slug: string, date = "2026-10-01", category = "Sport"): NewsItem {
  return { slug, date, category, title: slug, lead: "", body: [] };
}

function reader(total = 20): NewsReader {
  return {
    published: vi.fn(async () => Promise.resolve([item("a"), item("b")])),
    countPublished: vi.fn(async () => Promise.resolve(total)),
    find: vi.fn(async (year: string, slug: string) =>
      Promise.resolve(year === "2026" && slug === "rajd" ? item("rajd", "2026-10-09") : undefined),
    ),
    neighbours: vi.fn(async () => Promise.resolve({ newer: item("n"), older: undefined })),
    related: vi.fn(async () => Promise.resolve([item("r")])),
    categories: vi.fn(async () => Promise.resolve(["Zdrowie", "Sport"])),
    years: vi.fn(async () => Promise.resolve(["2026", "2025"])),
  };
}

const categories = [
  { name: "Sport", slug: "sport" },
  { name: "Zdrowie", slug: "zdrowie" },
];

describe("news listing", () => {
  it("loads the first page of all news with the filters", async ({ expect }) => {
    const source = reader();

    const listing = await loadListing(source, {}, undefined);

    expect(listing).toEqual({
      page: { items: [item("a"), item("b")], page: 1, pages: 3 },
      categories,
      years: ["2026", "2025"],
      category: undefined,
    });
    expect(source.countPublished).toHaveBeenCalledWith({});
    expect(source.published).toHaveBeenCalledWith({}, { limit: 9, offset: 0 });
  });

  it("filters by category slug and year and offsets later pages", async ({ expect }) => {
    const source = reader();

    const byCategory = await loadListing(source, { category: "zdrowie" }, "2");
    const byYear = await loadListing(source, { year: "2025" }, "3");

    expect(byCategory?.category).toEqual({ name: "Zdrowie", slug: "zdrowie" });
    expect(byCategory?.page.page).toBe(2);
    expect(source.published).toHaveBeenCalledWith({ category: "Zdrowie" }, { limit: 9, offset: 9 });
    expect(byYear?.page).toEqual({ items: [item("a"), item("b")], page: 3, pages: 3 });
    expect(source.published).toHaveBeenCalledWith({ year: "2025" }, { limit: 9, offset: 18 });
  });

  it("returns nothing for unknown filters and pages", async ({ expect }) => {
    const source = reader();

    expect(await loadListing(source, { category: "brak" }, undefined)).toBeUndefined();
    expect(await loadListing(source, { year: "1999" }, undefined)).toBeUndefined();
    expect(await loadListing(source, {}, "4")).toBeUndefined();
    expect(await loadListing(source, {}, "1")).toBeUndefined();
    expect(source.categories).toHaveBeenCalledTimes(3);
    expect(source.published).not.toHaveBeenCalled();
  });

  it("shows an empty first page when nothing is published", async ({ expect }) => {
    const listing = await loadListing(reader(0), {}, undefined);

    expect(listing?.page.pages).toBe(1);
    expect(await loadListing(reader(0), {}, "2")).toBeUndefined();
  });
});

describe("news article", () => {
  it("loads the article with its category, neighbours and related news", async ({ expect }) => {
    const source = reader();

    const article = await loadArticle(source, "2026", "rajd");

    expect(article).toEqual({
      item: item("rajd", "2026-10-09"),
      category: { name: "Sport", slug: "sport" },
      neighbours: { newer: item("n"), older: undefined },
      related: [item("r")],
    });
    expect(source.related).toHaveBeenCalledWith(item("rajd", "2026-10-09"), RELATED_COUNT);
    expect(RELATED_COUNT).toBe(3);
  });

  it("returns nothing for malformed or unknown addresses", async ({ expect }) => {
    const source = reader();

    expect(await loadArticle(source, "2026", "inny")).toBeUndefined();
    expect(await loadArticle(source, "26", "rajd")).toBeUndefined();
    expect(await loadArticle(source, undefined, "rajd")).toBeUndefined();
    expect(await loadArticle(source, "2026", undefined)).toBeUndefined();
    expect(source.find).toHaveBeenCalledTimes(1);
    expect(source.neighbours).not.toHaveBeenCalled();
  });
});

describe("latest news", () => {
  it("asks for the newest published items", async ({ expect }) => {
    const source = reader();

    expect(await latestNews(source, 5)).toEqual([item("a"), item("b")]);
    expect(source.published).toHaveBeenCalledWith({}, { limit: 5, offset: 0 });
  });
});
