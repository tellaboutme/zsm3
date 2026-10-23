import { describe, it } from "vitest";

import { staticSearchEntries } from "../src/data/search-index.ts";
import { newsEntry, SEARCH_NEWS_LIMIT } from "../src/lib/news-search.ts";
import {
  analyse,
  groupResults,
  isSearchIndex,
  PHRASE_BONUS,
  prepare,
  resultTypeLabels,
  score,
  search,
  suggestion,
  SUGGEST_EXTRA_LENGTH,
  TEXT_WEIGHT,
  TITLE_WEIGHT,
  type SearchEntry,
} from "../src/lib/search.ts";

const entry = (type: SearchEntry["type"], title: string, text = ""): SearchEntry => ({
  type,
  title,
  href: `/${title}`,
  text,
});

const titles = (results: readonly SearchEntry[]): readonly string[] =>
  results.map((item) => item.title);

describe("search ranking", () => {
  it("requires every word and ranks title matches first", ({ expect }) => {
    const index = prepare([
      entry("strona", "Kontakt", "sekretariat telefon"),
      entry("dokument", "Duplikat legitymacji", "szkolnej"),
      entry("aktualnosc", "Nowe legitymacje", "dla klas pierwszych"),
      entry("termin", "Ferie", "zimowe"),
    ]);

    expect(titles(search(index, "legitymacja"))).toEqual([
      "Duplikat legitymacji",
      "Nowe legitymacje",
    ]);
    expect(titles(search(index, "legitymacja szkolna"))).toEqual(["Duplikat legitymacji"]);
    expect(titles(search(index, "telefon"))).toEqual(["Kontakt"]);
    expect(search(index, "")).toEqual([]);
    expect(search(index, "a")).toEqual([]);
  });

  it("sorts equal matches by title and better matches first", ({ expect }) => {
    const equal = prepare([
      entry("termin", "Zebranie", "rodzice"),
      entry("termin", "Apel", "rodzice"),
    ]);
    const ranked = prepare([entry("strona", "Aaa", "zzz"), entry("strona", "Zzz", "inne")]);

    expect(titles(search(equal, "rodzice"))).toEqual(["Apel", "Zebranie"]);
    expect(titles(search(ranked, "zzz"))).toEqual(["Zzz", "Aaa"]);
  });

  it("weights the title over the text and rewards the whole phrase", ({ expect }) => {
    expect([TITLE_WEIGHT, TEXT_WEIGHT, PHRASE_BONUS]).toEqual([3, 1, 2]);
    const index = prepare([
      entry("strona", "Plan lekcji", "godziny"),
      entry("strona", "Lekcji plan", "godziny"),
    ]);
    const [first, second] = index.entries;
    if (first === undefined || second === undefined) {
      throw new Error("missing entries");
    }
    const terms = analyse(index, "plan lekcji");

    expect(score(first, terms)).toBe(2 * TITLE_WEIGHT + PHRASE_BONUS);
    expect(score(second, terms)).toBe(2 * TITLE_WEIGHT);
    expect(score(first, analyse(index, "godziny"))).toBe(TEXT_WEIGHT);
    expect(score(first, analyse(index, "plan"))).toBe(TITLE_WEIGHT);
    expect(score(first, [])).toBe(0);
  });

  it("finds class codes however they are typed", ({ expect }) => {
    const index = prepare([
      entry("klasa", "Klasa 4 Tp", "Sala 121."),
      entry("termin", "Praktyki", "Klasy 4 Tb, 4 Tp."),
      entry("klasa", "Klasa 3 Tp", "Sala 120."),
      entry("klasa", "Klasa 3 Ta/d", "Sala 223."),
    ]);

    for (const query of ["4TP", "4 tp", "4 Tp", "4tp"]) {
      expect(titles(search(index, query)), query).toEqual(["Klasa 4 Tp", "Praktyki"]);
    }
    expect(titles(search(index, "3TD"))).toEqual(["Klasa 3 Ta/d"]);
  });

  it("allows typos only for words that the site does not contain", ({ expect }) => {
    const index = prepare([
      entry("strona", "Dzwonki", "godziny lekcji"),
      entry("strona", "Dzwonek alarmowy"),
      entry("strona", "Sala", "salon"),
    ]);

    expect(analyse(index, "dzownki sala")).toEqual([
      { term: "dzownki", typos: true },
      { term: "sala", typos: false },
    ]);
    expect(titles(search(index, "dzownki"))).toEqual(["Dzwonki"]);
    expect(analyse(index, "onki")).toEqual([{ term: "onki", typos: true }]);
    expect(titles(search(index, "dzwonk"))).toEqual(["Dzwonek alarmowy", "Dzwonki"]);
  });
});

describe("search suggestions", () => {
  const index = prepare([
    entry("strona", "Dzwonki", "godziny lekcji"),
    entry("strona", "Sala 120", "dzwonkiem"),
  ]);

  it("proposes the closest existing word when nothing is found", ({ expect }) => {
    expect(SUGGEST_EXTRA_LENGTH).toBe(7);
    expect(suggestion(index, "dzwunkiy")).toBe("dzwonki");
    expect(suggestion(index, "godzzzziny")).toBe("godziny");
    expect(suggestion(index, "dzwonkiex")).toBe("dzwonkiem");
    expect(suggestion(index, "dzwonkix")).toBe("dzwonki");
    expect(suggestion(index, "dzwunky")).toBe("dzwonki");
    expect(suggestion(index, "dzwunkiy godziny")).toBe("dzwonki godziny");
  });

  it("leaves numbers, short words and unknown words alone", ({ expect }) => {
    expect(suggestion(index, "121")).toBeUndefined();
    expect(suggestion(index, "1205")).toBeUndefined();
    expect(suggestion(index, "12000000")).toBeUndefined();
    expect(suggestion(prepare([entry("dokument", "Numer 1234567")]), "1234568")).toBeUndefined();
    expect(suggestion(index, "dzwunkiy 1205")).toBeUndefined();
    expect(suggestion(index, "sal")).toBeUndefined();
    expect(suggestion(index, "matematyka")).toBeUndefined();
    expect(suggestion(index, "godzi")).toBeUndefined();
    expect(suggestion(index, "gdzny")).toBeUndefined();
    expect(suggestion(index, "dzwonki")).toBeUndefined();
  });
});

describe("search results", () => {
  it("groups results in the order the best match of each type appears", ({ expect }) => {
    const groups = groupResults([
      entry("termin", "Ferie"),
      entry("strona", "Kontakt"),
      entry("termin", "Matura"),
    ]);

    expect(groups.map((group) => [group.label, group.entries.length])).toEqual([
      ["Terminy", 2],
      ["Strony", 1],
    ]);
    expect(Object.values(resultTypeLabels)).toEqual([
      "Strony",
      "Kierunki",
      "Klasy i sale",
      "Kontakty",
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
});
