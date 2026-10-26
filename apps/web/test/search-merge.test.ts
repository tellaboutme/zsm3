import { describe, it } from "vitest";

import { mergeResults, SEARCH_RESULTS_LIMIT } from "../src/lib/search-server.ts";
import type { SearchEntry } from "../src/lib/search.ts";

const entry = (
  type: SearchEntry["type"],
  title: string,
  href: string,
  text = "opis",
): SearchEntry => ({ type, title, href, text });

describe("search merge", () => {
  it("keeps separate calendar dates and puts indexed matches before a crowded static index", ({
    expect,
  }) => {
    const staticResults = [
      entry("termin", "Zebranie", "/szkola/terminarz", "9 września 2026 Rodzice"),
      entry("termin", "Zebranie", "/szkola/terminarz", "18 listopada 2026 Rodzice"),
      ...[...Array.from({ length: SEARCH_RESULTS_LIMIT }).keys()].map((index) =>
        entry("strona", `Strona ${String(index)}`, `/strona-${String(index)}`),
      ),
    ];
    const fresh = entry("strona", "Nowa strona", "/nowa-strona");
    const results = mergeResults(staticResults, [fresh]);

    expect(results[0]).toEqual(fresh);
    expect(results.slice(1, 3)).toEqual(staticResults.slice(0, 2));
    expect(results).toHaveLength(SEARCH_RESULTS_LIMIT);
    expect(
      mergeResults(
        [staticResults[0], staticResults[0]].filter((item) => item !== undefined),
        [],
      ),
    ).toHaveLength(1);
  });

  it("discovers programmes and calendar dates alongside 50 indexed matches without stale duplicates", ({
    expect,
  }) => {
    const programme = entry("kierunek", "Technik lotnictwa", "/kierunki/lotnictwo");
    const otherProgramme = entry("kierunek", "Technik pojazdów", "/kierunki/pojazdy");
    const dates = [
      entry("termin", "Egzamin", "/szkola/terminarz", "9 stycznia 2027"),
      entry("termin", "Egzamin", "/szkola/terminarz", "10 stycznia 2027"),
    ];
    const indexed = [
      entry("strona", "Aktualny opis", "/kierunki/lotnictwo"),
      ...[...Array.from({ length: 49 }).keys()].map((position) =>
        entry(
          "aktualnosc",
          `Wiadomość ${String(position)}`,
          `/aktualnosci/2026/${String(position)}`,
        ),
      ),
    ];
    const results = mergeResults(
      [entry("strona", "Nieaktualny opis", programme.href), programme, otherProgramme, ...dates],
      indexed,
    );

    expect(results).toHaveLength(SEARCH_RESULTS_LIMIT);
    expect(results[0]?.title).toBe("Aktualny opis");
    expect(
      results.filter((result) => result.href === programme.href).map((result) => result.title),
    ).toEqual(["Aktualny opis", "Technik lotnictwa"]);
    expect(results).toContainEqual(otherProgramme);
    expect(results.filter((result) => result.type === "termin")).toEqual(dates);
    expect(results.some((result) => result.type === "aktualnosc")).toBe(true);
  });

  it("replaces only the indexed page while preserving events, contact cards and documents at its URL", ({
    expect,
  }) => {
    const staticResults = [
      entry("strona", "Stary terminarz", "/szkola/terminarz"),
      entry("termin", "Egzamin", "/szkola/terminarz", "1 czerwca"),
      entry("termin", "Egzamin", "/szkola/terminarz", "2 czerwca"),
      entry("strona", "Stary kontakt", "/kontakt"),
      entry("kontakt", "Sekretariat", "/kontakt", "telefon"),
      entry("kontakt", "Księgowość", "/kontakt", "telefon"),
      entry("dokument", "Wniosek", "/kontakt", "formularz"),
    ];
    const indexed = [
      entry("strona", "Nowy terminarz", "/szkola/terminarz"),
      entry("strona", "Nowy kontakt", "/kontakt"),
    ];
    const results = mergeResults([...staticResults, ...staticResults], indexed);

    expect(results.filter((result) => result.type === "strona")).toEqual(indexed);
    expect(results.filter((result) => result.type === "termin")).toEqual(staticResults.slice(1, 3));
    expect(results.filter((result) => result.type === "kontakt")).toEqual(
      staticResults.slice(4, 6),
    );
    expect(results.filter((result) => result.type === "dokument")).toEqual(staticResults.slice(6));
  });
});
