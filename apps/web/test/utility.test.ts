import { describe, it } from "vitest";

import { privacyPolicy } from "../src/data/legal/privacy.ts";
import { staticSearchEntries } from "../src/data/search-index.ts";
import { siteMap } from "../src/data/site-map.ts";
import { statusLabel } from "../src/lib/legal.ts";
import { newsEntry, SEARCH_NEWS_LIMIT } from "../src/lib/news-search.ts";
import {
  fold,
  groupResults,
  isSearchIndex,
  queryTerms,
  resultTypeLabels,
  search,
  stem,
  type SearchEntry,
} from "../src/lib/search.ts";
import { flattenMap, mapHrefs } from "../src/lib/site-map.ts";

const entry = (type: SearchEntry["type"], title: string, text = ""): SearchEntry => ({
  type,
  title,
  href: `/${title}`,
  text,
});

describe("search", () => {
  it("folds Polish letters, case and punctuation", ({ expect }) => {
    expect(fold("  Zażółć GĘŚLĄ, jaźń!  ")).toBe("zazolc gesla jazn");
    expect(fold("Łódź-2026")).toBe("lodz 2026");
  });

  it("cuts common endings from longer words", ({ expect }) => {
    expect(stem("abcd")).toBe("abcd");
    expect(stem("dzwon")).toBe("dzwo");
    expect(stem("dzwonki")).toBe("dzwon");
    expect(stem("legitymacja")).toBe("legityma");
    expect(queryTerms("x")).toEqual([]);
    expect(queryTerms("it")).toEqual(["it"]);
    expect(queryTerms("Legitymacja szkolna")).toEqual(["legityma", "szkol"]);
  });

  it("requires every word and ranks title matches first", ({ expect }) => {
    const entries = [
      entry("strona", "Kontakt", "sekretariat telefon"),
      entry("dokument", "Duplikat legitymacji", "szkolnej"),
      entry("aktualnosc", "Nowe legitymacje", "dla klas pierwszych"),
      entry("termin", "Ferie", "zimowe"),
    ];

    expect(search(entries, "legitymacja").map((item) => item.title)).toEqual([
      "Duplikat legitymacji",
      "Nowe legitymacje",
    ]);
    expect(search(entries, "legitymacja szkolna").map((item) => item.title)).toEqual([
      "Duplikat legitymacji",
    ]);
    expect(search(entries, "telefon")).toEqual([entries[0]]);
    expect(search(entries, "")).toEqual([]);
  });

  it("sorts equal matches by title and better matches first", ({ expect }) => {
    const equal = [entry("termin", "Zebranie", "rodzice"), entry("termin", "Apel", "rodzice")];
    const ranked = [entry("strona", "Aaa", "zzz"), entry("strona", "Zzz", "inne")];

    expect(search(equal, "rodzice").map((item) => item.title)).toEqual(["Apel", "Zebranie"]);
    expect(search(ranked, "zzz").map((item) => item.title)).toEqual(["Zzz", "Aaa"]);
  });

  it("prefers matches in the title over matches in the text", ({ expect }) => {
    const entries = [entry("strona", "Plan", "dzwonki"), entry("strona", "Dzwonki", "plan")];

    expect(search(entries, "dzwonki").map((item) => item.title)).toEqual(["Dzwonki", "Plan"]);
  });

  it("groups results in a fixed order with Polish labels", ({ expect }) => {
    const groups = groupResults([
      entry("termin", "Ferie"),
      entry("strona", "Kontakt"),
      entry("termin", "Matura"),
    ]);

    expect(groups.map((group) => [group.label, group.entries.length])).toEqual([
      ["Strony", 1],
      ["Terminy", 2],
    ]);
    expect(Object.values(resultTypeLabels)).toEqual([
      "Strony",
      "Kierunki",
      "Aktualności",
      "Dokumenty",
      "Terminy",
    ]);
  });

  it("accepts only a well-formed index from the server", ({ expect }) => {
    expect(isSearchIndex(staticSearchEntries)).toBe(true);
    expect(isSearchIndex([])).toBe(true);
    expect(isSearchIndex({})).toBe(false);
    expect(isSearchIndex([null])).toBe(false);
    expect(isSearchIndex([{ ...entry("strona", "A"), type: "inne" }])).toBe(false);
    expect(isSearchIndex([{ ...entry("strona", "A"), title: 1 }])).toBe(false);
    expect(isSearchIndex([{ ...entry("strona", "A"), href: "https://example.com" }])).toBe(false);
    expect(isSearchIndex([{ ...entry("strona", "A"), href: 1 }])).toBe(false);
    expect(isSearchIndex([{ ...entry("strona", "A"), text: null }])).toBe(false);
  });

  it("indexes news by title, category, lead and body text", ({ expect }) => {
    expect(
      newsEntry({
        slug: "rajd",
        date: "2026-10-09",
        category: "Sport",
        title: "Rajd",
        lead: "Trasa.",
        body: [{ type: "paragraph", content: [{ type: "text", text: "Park Jordana." }] }],
      }),
    ).toEqual({
      type: "aktualnosc",
      title: "Rajd",
      href: "/aktualnosci/2026/rajd",
      text: "Sport Trasa. Park Jordana.",
    });
    expect(SEARCH_NEWS_LIMIT).toBe(100);
  });

  it("indexes every kind of content", ({ expect }) => {
    const types = new Set(staticSearchEntries.map((item) => item.type));

    expect([...types].toSorted()).toEqual(["dokument", "kierunek", "strona", "termin"]);
    expect(
      search(staticSearchEntries, "legitymacja").some((item) => item.type === "dokument"),
    ).toBe(true);
  });
});

describe("site map", () => {
  it("lists every page once", ({ expect }) => {
    const hrefs = mapHrefs(siteMap);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/kandydaci/zawody/technik-awionik");
    expect(hrefs).toContain("/aktualnosci");
    expect(hrefs).toContain("/polityka-prywatnosci");
  });

  it("flattens nested nodes depth first", ({ expect }) => {
    const nodes = [
      { label: "A", href: "/a", children: [{ label: "B", href: "/b" }] },
      { label: "C", href: "/c" },
    ];

    expect(flattenMap(nodes).map((node) => node.label)).toEqual(["A", "B", "C"]);
  });
});

describe("legal documents", () => {
  it("label their status", ({ expect }) => {
    expect(statusLabel(privacyPolicy)).toBe(
      "Projekt do zatwierdzenia przez inspektora ochrony danych",
    );
    expect(statusLabel({ ...privacyPolicy, status: "obowiązuje" })).toBe("Dokument obowiązujący");
  });
});
