import { describe, it } from "vitest";

import {
  absoluteUrl,
  canonicalUrl,
  jsonLd,
  rssXml,
  schoolYearSchemas,
  shouldNoindex,
  sitemapEntries,
  sitemapXml,
  SITE_ORIGIN,
} from "../src/lib/seo.ts";

const article = {
  slug: "school-day",
  date: "2026-10-21",
  category: "Szkoła",
  title: "A < B & C > D ' E \" F",
  lead: "Test & news",
  body: [],
};

describe("canonical addresses", () => {
  it("joins a path with its origin", ({ expect }) => {
    expect(absoluteUrl("https://example.org", "/kontakt")).toBe("https://example.org/kontakt");
    expect(SITE_ORIGIN).toBe("https://www.zespolszkolmechanicznych.edu.pl");
  });

  it("lowercases the path and drops the query, fragment and trailing slashes", ({ expect }) => {
    expect(canonicalUrl(new URL("https://example.org/AKTUALNOSCI///?q=test#section"))).toBe(
      "https://www.zespolszkolmechanicznych.edu.pl/aktualnosci",
    );
    expect(canonicalUrl(new URL("https://example.org/kontakt/"))).toBe(
      "https://www.zespolszkolmechanicznych.edu.pl/kontakt",
    );
  });

  it("keeps the single slash of the home page", ({ expect }) => {
    expect(canonicalUrl(new URL("https://example.org/?q=test"))).toBe(
      "https://www.zespolszkolmechanicznych.edu.pl/",
    );
  });
});

describe("pages kept out of the index", () => {
  it("excludes search, filtered archives, pagination and query-bearing addresses", ({ expect }) => {
    for (const path of [
      "/szukaj",
      "/aktualnosci/strona/2",
      "/aktualnosci/kategoria/szkola",
      "/aktualnosci/2026",
      "/aktualnosci/2026/strona/2",
      "/aktualnosci?category=szkola",
      "/kontakt?utm_source=mail",
    ]) {
      expect(shouldNoindex(new URL(path, "https://example.org"))).toBe(true);
    }
  });

  it("indexes articles, sections and the home page", ({ expect }) => {
    for (const path of ["/", "/kontakt", "/aktualnosci", "/aktualnosci/2026/artykul"]) {
      expect(shouldNoindex(new URL(path, "https://example.org"))).toBe(false);
    }
  });
});

describe("sitemap entries", () => {
  it("keeps indexable static paths in their original order", ({ expect }) => {
    expect(sitemapEntries(["/", "/szukaj", "/kontakt", "/aktualnosci/strona/2"], [])).toEqual([
      { path: "/" },
      { path: "/kontakt" },
    ]);
  });

  it("adds published pages and lets them date a static path", ({ expect }) => {
    expect(
      sitemapEntries(
        ["/", "/kontakt"],
        [
          { path: "/kontakt", lastmod: "2026-10-21T12:00:00.000Z" },
          { path: "/aktualnosci/2026/artykul", lastmod: "2026-10-22T12:00:00.000Z" },
        ],
      ),
    ).toEqual([
      { path: "/" },
      { path: "/kontakt", lastmod: "2026-10-21T12:00:00.000Z" },
      { path: "/aktualnosci/2026/artykul", lastmod: "2026-10-22T12:00:00.000Z" },
    ]);
  });

  it("keeps one entry per path", ({ expect }) => {
    expect(
      sitemapEntries(
        ["/kontakt", "/kontakt"],
        [
          { path: "/kontakt", lastmod: "2026-10-21T12:00:00.000Z" },
          { path: "/kontakt", lastmod: "2026-10-22T12:00:00.000Z" },
        ],
      ),
    ).toEqual([{ path: "/kontakt", lastmod: "2026-10-22T12:00:00.000Z" }]);
  });
});

describe("sitemap document", () => {
  it("escapes addresses and shortens a timestamp to its date", ({ expect }) => {
    expect(
      sitemapXml("https://example.org", [{ path: "/a&b", lastmod: "2026-10-21T12:00:00.000Z" }]),
    ).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        "<url><loc>https://example.org/a&amp;b</loc><lastmod>2026-10-21</lastmod></url>" +
        "</urlset>",
    );
  });

  it("omits a lastmod that is not known", ({ expect }) => {
    expect(sitemapXml("https://example.org", [{ path: "/" }])).toContain(
      "<url><loc>https://example.org/</loc></url>",
    );
    expect(sitemapXml("https://example.org", [])).not.toContain("<url>");
  });
});

describe("news feed", () => {
  it("publishes absolute links, escaped content and an RFC 822 date", ({ expect }) => {
    const xml = rssXml("https://example.org", [article]);

    expect(xml).toContain("<title>A &lt; B &amp; C &gt; D &apos; E &quot; F</title>");
    expect(xml).toContain(
      '<link>https://example.org/aktualnosci/2026/school-day</link><guid isPermaLink="true">https://example.org/aktualnosci/2026/school-day</guid>',
    );
    expect(xml).toContain("<description>Test &amp; news</description>");
    expect(xml).toContain("<pubDate>Wed, 21 Oct 2026 00:00:00 GMT</pubDate>");
  });

  it("describes the channel even without items", ({ expect }) => {
    expect(rssXml("https://example.org", [])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>' +
        "<title>Aktualności — ZSM3</title>" +
        "<link>https://example.org/aktualnosci</link>" +
        "<description>Aktualności Zespołu Szkół Mechanicznych nr 3 w Krakowie.</description>" +
        "<language>pl</language></channel></rss>",
    );
  });
});

describe("structured data", () => {
  it("prevents content from closing its own script tag", ({ expect }) => {
    expect(jsonLd({ name: "</script><img src=x>&" })).toBe(
      '{"name":"\\u003c/script\\u003e\\u003cimg src=x\\u003e\\u0026"}',
    );
  });
});

describe("school year events as structured data", () => {
  const events = [
    { date: "2026-09-01", title: "Rozpoczęcie roku", audience: "Wszyscy", kind: "rok-szkolny" },
    {
      date: "2026-12-23",
      title: "Przerwa świąteczna",
      audience: "Wszyscy",
      kind: "przerwa",
      note: "Do 31 grudnia.",
    },
    {
      date: "2027-06-25",
      title: "Zakończenie roku",
      audience: "Wszyscy",
      kind: "rok-szkolny",
      note: "O godzinie 9:00.",
    },
  ] as const;

  it("describes only the dates that open and close the year", ({ expect }) => {
    expect(schoolYearSchemas(events, "/szkola/terminarz").map((schema) => schema)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Rozpoczęcie roku",
        startDate: "2026-09-01",
        url: "https://www.zespolszkolmechanicznych.edu.pl/szkola/terminarz",
      },
      {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Zakończenie roku",
        startDate: "2027-06-25",
        description: "O godzinie 9:00.",
        url: "https://www.zespolszkolmechanicznych.edu.pl/szkola/terminarz",
      },
    ]);
  });

  it("says nothing when the year holds no such date", ({ expect }) => {
    expect(schoolYearSchemas([], "/szkola/terminarz")).toEqual([]);
  });
});
