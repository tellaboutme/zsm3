import fc from "fast-check";
import { describe, it } from "vitest";

import { news } from "../src/data/news/index.ts";
import {
  categoryHref,
  laterPages,
  neighbours,
  NEWS_PAGE_SIZE,
  newsCategories,
  newsYear,
  newsYears,
  pageCount,
  pageHref,
  pageWindow,
  paginate,
  relatedNews,
  slugify,
  type NewsItem,
} from "../src/lib/news.ts";

function item(slug: string, date: string, category: string): NewsItem {
  return { slug, date, category, title: slug, lead: "", body: [] };
}

function bySlug(slug: string): NewsItem {
  const found = news.find((entry) => entry.slug === slug);
  if (found === undefined) {
    throw new Error(`missing ${slug}`);
  }
  return found;
}

describe("news fixtures", () => {
  it("have unique slugs and valid dates", ({ expect }) => {
    expect(new Set(news.map((entry) => entry.slug)).size).toBe(news.length);
    for (const entry of news) {
      expect(entry.date, entry.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(entry.body.length, entry.slug).toBeGreaterThan(0);
    }
  });

  it("need more than one page so pagination is exercised", ({ expect }) => {
    expect(news.length).toBeGreaterThan(NEWS_PAGE_SIZE);
  });
});

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
    const categories = newsCategories([
      item("a", "2026-01-01", "Zdrowie"),
      item("b", "2026-01-02", "Środowisko"),
      item("c", "2026-01-03", "Sport"),
      item("d", "2026-01-04", "Sport"),
    ]);

    expect(categories).toEqual([
      { name: "Sport", slug: "sport" },
      { name: "Środowisko", slug: "srodowisko" },
      { name: "Zdrowie", slug: "zdrowie" },
    ]);
    expect(categoryHref({ name: "Sport", slug: "sport" })).toBe("/aktualnosci/kategoria/sport");
  });

  it("lists years newest first", ({ expect }) => {
    const items = [
      item("a", "2024-05-01", "Sport"),
      item("b", "2026-05-01", "Sport"),
      item("c", "2025-05-01", "Sport"),
      item("d", "2026-01-01", "Sport"),
    ];

    expect(newsYears(items)).toEqual(["2026", "2025", "2024"]);
    expect(newsYear(item("x", "2025-12-31", "Sport"))).toBe("2025");
  });
});

describe("pagination", () => {
  it("counts pages and the pages after the first", ({ expect }) => {
    expect(pageCount(0, 9)).toBe(1);
    expect(pageCount(9, 9)).toBe(1);
    expect(pageCount(10, 9)).toBe(2);
    expect(laterPages(9, 9)).toEqual([]);
    expect(laterPages(28, 9)).toEqual([2, 3, 4]);
  });

  it("slices one page and rejects pages that do not exist", ({ expect }) => {
    const items = [...Array.from({ length: 20 }).keys()].map((index) => index + 1);

    expect(paginate(items, 1, 9)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      page: 1,
      pages: 3,
    });
    expect(paginate(items, 3, 9)).toEqual({ items: [19, 20], page: 3, pages: 3 });
    expect(paginate([], 1, 9)).toEqual({ items: [], page: 1, pages: 1 });
    expect(() => paginate(items, 0, 9)).toThrow("Page 0 is outside 1–3");
    expect(() => paginate(items, 4, 9)).toThrow(RangeError);
    expect(() => paginate(items, 1.5, 9)).toThrow(RangeError);
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

describe("article navigation", () => {
  it("finds the newer and older article", ({ expect }) => {
    const middle = neighbours(news, bySlug("konkurs-bogdan-wlosik-i-jego-nowohucka-mala-ojczyzna"));

    expect(middle.newer?.slug).toBe("swiatowy-dzien-przywracania-czynnosci-serca");
    expect(middle.older?.slug).toBe("druzyna-mistrzow");
    expect(
      neighbours(news, bySlug("kurs-programowania-robotow-przemyslowych")).newer,
    ).toBeUndefined();
    expect(neighbours(news, bySlug("salon-maturzystow-2026")).older).toBeUndefined();
  });

  it("prefers related news from the same category, newest first", ({ expect }) => {
    const items = [
      item("a", "2026-01-05", "Sport"),
      item("b", "2026-01-04", "Zdrowie"),
      item("c", "2026-01-03", "Sport"),
      item("d", "2026-01-02", "Zdrowie"),
      item("e", "2026-01-01", "Sport"),
    ];
    const target = items[4];
    if (target === undefined) {
      throw new Error("fixture");
    }

    expect(relatedNews(items, target, 3).map((entry) => entry.slug)).toEqual(["a", "c", "b"]);
    expect(relatedNews(items, target, 10).map((entry) => entry.slug)).toEqual(["a", "c", "b", "d"]);
  });
});
