import { seedPages } from "@zsm3/worker/seed/pages/index.ts";
import { describe, it } from "vitest";

import { staticSearchEntries } from "../src/data/search-index.ts";
import { contentPageEntry } from "../src/lib/search-sources.ts";
import { prepare, search } from "../src/lib/search.ts";

describe("site search index", () => {
  const index = prepare([...staticSearchEntries, ...seedPages.map(contentPageEntry)]);
  const first = (query: string): string | undefined => search(index, query)[0]?.title;

  it("indexes every kind of static content", ({ expect }) => {
    const types = new Set(staticSearchEntries.map((item) => item.type));

    expect([...types].toSorted()).toEqual([
      "dokument",
      "kierunek",
      "klasa",
      "kontakt",
      "strona",
      "termin",
    ]);
  });

  it("answers the questions people ask the school", ({ expect }) => {
    expect(first("4TP")).toBe("Klasa 4 Tp");
    expect(first("legitymacja")).toBe("W6: Wniosek o wydanie duplikatu legitymacji");
    expect(first("sekretariat")).toBe("Sekretariat główny");
    expect(first("dzwonki")).toBe("Dzwonki: godziny lekcji i przerw");
    expect(first("awionika")).toBe("Technik awionik (Technikum)");
    expect(first("INF03")).toBe("Technik informatyk (Technikum)");
    expect(first("Sikorski")).toBe("Gen. Władysław Sikorski");
    expect(first("ferie")).toBe("Ferie zimowe");
  });
});
