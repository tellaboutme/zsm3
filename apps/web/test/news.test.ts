import fc from "fast-check";
import { describe, it } from "vitest";

import {
  categoryHref,
  isYearParam,
  newsHref,
  newsYear,
  pageCount,
  pageHref,
  pageWindow,
  parsePageParam,
  slugify,
  sortedCategories,
  toCategory,
  type NewsItem,
} from "../src/lib/news.ts";

function item(slug: string, date: string, category: string): NewsItem {
  return { slug, date, category, title: slug, lead: "", body: [] };
}

describe("slugify", () => {
  it("turns Polish names into ASCII slugs", ({ expect }) => {
    expect(slugify("Wychowanie fizyczne")).toBe("wychowanie-fizyczne");
    expect(slugify("Uroczystości")).toBe("uroczystosci");
    expect(slugify("Zażółć gęślą jaźń")).toBe("zazolc-gesla-jazn");
    expect(slugify("ŁÓDŹ")).toBe("lodz");
    expect(slugify("  Erasmus+ 2026!  ")).toBe("erasmus-2026");
  });

  it("always yields a URL-safe slug", ({ expect }) => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(slugify(text)).toMatch(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/u);
      }),
    );
  });
});

describe("categories and years", () => {
  it("lists categories alphabetically in Polish order with slugs", ({ expect }) => {
    expect(sortedCategories(["Zdrowie", "Środowisko", "Sport"])).toEqual([
      { name: "Sport", slug: "sport" },
      { name: "Środowisko", slug: "srodowisko" },
      { name: "Zdrowie", slug: "zdrowie" },
    ]);
    expect(toCategory("Wychowanie fizyczne")).toEqual({
      name: "Wychowanie fizyczne",
      slug: "wychowanie-fizyczne",
    });
    expect(categoryHref({ name: "Sport", slug: "sport" })).toBe("/aktualnosci/kategoria/sport");
  });

  it("links an article under the year of its date", ({ expect }) => {
    expect(newsYear(item("x", "2025-12-31", "Sport"))).toBe("2025");
    expect(newsHref(item("rajd", "2026-10-09", "Sport"))).toBe("/aktualnosci/2026/rajd");
  });

  it("accepts only four-digit years from the address", ({ expect }) => {
    expect(isYearParam("2026")).toBe(true);
    expect(isYearParam(undefined)).toBe(false);
    expect(isYearParam("202")).toBe(false);
    expect(isYearParam("20266")).toBe(false);
    expect(isYearParam("x2026")).toBe(false);
  });
});

describe("pagination", () => {
  it("counts pages", ({ expect }) => {
    expect(pageCount(0, 9)).toBe(1);
    expect(pageCount(9, 9)).toBe(1);
    expect(pageCount(10, 9)).toBe(2);
  });

  it("reads later page numbers from the address and rejects the rest", ({ expect }) => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("2")).toBe(2);
    expect(parsePageParam("9999")).toBe(9999);
    expect(parsePageParam("1")).toBeUndefined();
    expect(parsePageParam("0")).toBeUndefined();
    expect(parsePageParam("02")).toBeUndefined();
    expect(parsePageParam("10000")).toBeUndefined();
    expect(parsePageParam("2a")).toBeUndefined();
    expect(parsePageParam("a2")).toBeUndefined();
    expect(parsePageParam("")).toBeUndefined();
  });

  it("links the first page without a page number", ({ expect }) => {
    expect(pageHref("/aktualnosci", 1)).toBe("/aktualnosci");
    expect(pageHref("/aktualnosci", 3)).toBe("/aktualnosci/strona/3");
  });

  it("shows the first, last and neighbouring pages with gaps", ({ expect }) => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
  });

  it("keeps the window ordered, bounded and short", ({ expect }) => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 1, max: 500 }), (a, b) => {
        const total = Math.max(a, b);
        const current = Math.min(a, b);
        const pages = pageWindow(current, total).filter((entry) => entry !== null);

        expect(pages).toContain(1);
        expect(pages).toContain(current);
        expect(pages).toContain(total);
        expect(pages).toEqual(pages.toSorted((first, second) => first - second));
        expect(pageWindow(current, total).length).toBeLessThanOrEqual(7);
      }),
    );
  });
});
