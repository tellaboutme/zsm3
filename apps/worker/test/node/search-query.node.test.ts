import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import type { Store } from "../../src/storage/database.ts";
import { matchQuery, searchRepo, type SearchTerms } from "../../src/storage/search-repo.ts";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("search queries", () => {
  it("requires the whole term to be alphanumeric before constructing FTS syntax", ({ expect }) => {
    expect(matchQuery([["abc!", "!abc", "abc"]])).toBe('{title body}: ("abc"*)');
    expect(matchQuery([["abc!"], ["!abc"]])).toBeUndefined();
  });

  it("removes an indexed document", async ({ expect }) => {
    const repo = searchRepo(store());
    await repo.index({
      docId: "p:removed",
      kind: "strona",
      href: "/removed",
      title: "Usuwany dokument",
      body: "Treść",
      publishedOn: null,
    });
    expect(await repo.search([["usuwany"]], 10)).toHaveLength(1);

    await repo.remove("p:removed");
    expect(await repo.search([["usuwany"]], 10)).toEqual([]);
  });

  it("matches prefixes of folded words", async ({ expect }) => {
    const repo = searchRepo(store());
    await repo.index({
      docId: "n:prefix",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/legitymacje",
      title: "Nowe legitymacje szkolne",
      body: "opis",
      publishedOn: "2026-09-01",
    });

    expect(await repo.search([["legitymacj"]], 10)).toHaveLength(1);
    expect(await repo.search([["legx"]], 10)).toEqual([]);
  });

  it("ranks a title match above a body match with bm25", async ({ expect }) => {
    const repo = searchRepo(store());
    await repo.index({
      docId: "n:title",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/tytul",
      title: "legitymacje",
      body: "cos innego",
      publishedOn: "2026-09-01",
    });
    await repo.index({
      docId: "n:body",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/tresc",
      title: "cos innego",
      body: "legitymacje",
      publishedOn: "2026-09-02",
    });

    const found = await repo.search([["legitymacj"]], 10);
    expect(found.map((doc) => doc.docId)).toEqual(["n:title", "n:body"]);
  });

  it("expands synonyms as OR groups and still requires every group", async ({ expect }) => {
    const repo = searchRepo(store());
    await repo.index({
      docId: "n:lot",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/lot",
      title: "Pokazy lotnicze",
      body: "relacja",
      publishedOn: "2026-09-01",
    });
    await repo.index({
      docId: "n:air",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/samolot",
      title: "Nowy samolot",
      body: "relacja",
      publishedOn: "2026-09-02",
    });
    await repo.index({
      docId: "n:other",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/inna",
      title: "Inna szkoła",
      body: "relacja",
      publishedOn: "2026-09-03",
    });

    const synonyms: SearchTerms = [["lotnicze", "samolot", "awionik", "lotnisko"]];
    expect((await repo.search(synonyms, 10)).map((doc) => doc.docId).toSorted()).toEqual([
      "n:air",
      "n:lot",
    ]);
    expect(await repo.search([["samoloty"], ["nieobecne"]], 10)).toEqual([]);
  });

  it("applies the limit", async ({ expect }) => {
    const repo = searchRepo(store());
    for (const index of [1, 2, 3]) {
      await repo.index({
        docId: `n:${String(index)}`,
        kind: "strona",
        href: `/strona-${String(index)}`,
        title: `Szkoła ${String(index)}`,
        body: "opis",
        publishedOn: null,
      });
    }

    expect(await repo.search([["szkola"]], 2)).toHaveLength(2);
    expect(await repo.search([["szkola"]], 10)).toHaveLength(3);
  });

  it("drops hostile FTS syntax instead of breaking the query", async ({ expect }) => {
    const repo = searchRepo(store());
    await repo.index({
      docId: "n:words",
      kind: "strona",
      href: "/slowa",
      title: "Słowa i znaki",
      body: "or near and not",
      publishedOn: null,
    });

    expect(await repo.search([["or"], ["near"], ["and"]], 10)).toHaveLength(1);
    expect(await repo.search([["*"], ["NEAR("], ['"'], ["("], ["a OR b"]], 10)).toEqual([]);
    expect(await repo.search([], 10)).toEqual([]);
    expect(await repo.search([[]], 10)).toEqual([]);
  });
});
