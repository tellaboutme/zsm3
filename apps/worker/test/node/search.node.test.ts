import { DatabaseSync } from "node:sqlite";

import type { ContentPage, News } from "@zsm3/contracts/content";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import type { Store } from "../../src/storage/database.ts";
import { newsRepo } from "../../src/storage/news-repo.ts";
import { pagesRepo } from "../../src/storage/pages-repo.ts";
import { reindex, searchRepo } from "../../src/storage/search-repo.ts";

function store(db = memoryDatabase()): Store {
  return { db, clock: FIXED_CLOCK, random: counterRandom() };
}

const body = [
  { type: "paragraph" as const, content: [{ type: "text" as const, text: "Treść o Łodzi." }] },
];

function news(slug: string, overrides: Partial<News> = {}): News {
  return {
    slug,
    date: "2026-09-01",
    category: "Sport",
    title: `Tytuł ${slug}`,
    lead: "Lead.",
    body,
    ...overrides,
  };
}

function page(path: string): ContentPage {
  return {
    path,
    kicker: "Sekcja",
    title: `Strona ${path}`,
    intro: "Wstęp o łódzkich warsztatach.",
    sections: [
      {
        id: "odznaki",
        title: "Odznaki i legitymacje",
        blocks: [
          { type: "facts", label: "Oferta", facts: [{ value: "Łódź", label: "miasto" }] },
          {
            type: "timeline",
            items: [{ label: "2026", title: "Samoloty", text: "Pokazy lotnicze" }],
          },
          { type: "callout", title: "Zapisy", text: "Zapisz klasę 4 Tp" },
          {
            type: "files",
            label: "Druki",
            files: [
              {
                title: "Wniosek o legitymację",
                href: `/media/d/${"a".repeat(64)}.pdf`,
                format: "pdf",
                bytes: 10,
              },
            ],
          },
        ],
      },
    ],
  };
}

async function storedNews(
  db = memoryDatabase(),
  slug = "a",
  overrides: Partial<News> = {},
): Promise<void> {
  await newsRepo(store(db)).save(news(slug, overrides), "published");
}

describe("node sqlite", () => {
  it("ships FTS5 with the unicode61 tokenizer", ({ expect }) => {
    const probe = new DatabaseSync(":memory:");
    expect(() => {
      probe.exec("CREATE VIRTUAL TABLE probe USING fts5(text, tokenize = 'unicode61')");
    }).not.toThrow();
  });
});

describe("news index sync", () => {
  it("indexes published news with folded text and keeps the raw title", async ({ expect }) => {
    const db = memoryDatabase();
    await newsRepo(store(db)).save(
      news("salon-lodzkich", { title: "Łódzkie warsztaty" }),
      "published",
    );

    const found = await searchRepo(store(db)).search([["lodz"]], 10);
    expect(found.map((doc) => doc.kind)).toEqual(["aktualnosc"]);
    expect(found[0]?.title).toBe("Łódzkie warsztaty");
    expect(found[0]?.href).toBe("/aktualnosci/2026/salon-lodzkich");
    expect(found[0]?.publishedOn).toBe("2026-09-01");
    expect(found[0]?.docId).toMatch(/^n:[\da-f-]{36}$/u);
  });

  it("indexes category, lead, body text and cover texts", async ({ expect }) => {
    const db = memoryDatabase();
    await storedNews(db, "pelna", {
      category: "Lotnictwo",
      lead: "Nagłówek o samolotach",
      body: [{ type: "paragraph", content: [{ type: "text", text: "Relacja z pokazów." }] }],
      cover: { caption: "Samolot nad szkołą", credit: "Archiwum" },
    });
    const repo = searchRepo(store(db));

    expect(await repo.search([["samolot"]], 10)).toHaveLength(1);
    expect(await repo.search([["pokaz"]], 10)).toHaveLength(1);
    expect(await repo.search([["archiwum"]], 10)).toHaveLength(1);
    expect(await repo.search([["brak"]], 10)).toEqual([]);
  });

  it("keeps drafts out of the index and removes unpublished news", async ({ expect }) => {
    const db = memoryDatabase();
    const repo = newsRepo(store(db));
    const search = searchRepo(store(db));
    await repo.save(news("draft", { title: "Łódzkie szkice" }), "draft");
    expect(await search.search([["lodz"]], 10)).toEqual([]);

    await repo.save(news("draft", { title: "Łódzkie szkice" }), "published");
    expect(await search.search([["lodz"]], 10)).toHaveLength(1);

    await repo.save(news("draft", { title: "Łódzkie szkice" }), "draft");
    expect(await search.search([["lodz"]], 10)).toEqual([]);
  });

  it("replaces the indexed document when the same news is saved again", async ({ expect }) => {
    const db = memoryDatabase();
    const repo = newsRepo(store(db));
    await repo.save(news("a", { title: "Stary tytuł Łodzi" }), "published");
    await repo.save(news("a", { title: "Nowy tytuł Łodzi" }), "published");

    const found = await searchRepo(store(db)).search([["lodz"]], 10);
    expect(found.map((doc) => doc.title)).toEqual(["Nowy tytuł Łodzi"]);
    expect(db.sqlite.prepare("SELECT count(*) AS total FROM search_documents").get()).toEqual({
      total: 1,
    });
  });
});

describe("page index sync", () => {
  it("indexes published pages with intro and section texts by block type", async ({ expect }) => {
    const db = memoryDatabase();
    const repo = pagesRepo(store(db));
    const search = searchRepo(store(db));
    await repo.save(page("/szkola/warsztaty"), "published");

    const found = await search.search([["warsztat"]], 10);
    expect(found.map((doc) => doc.kind)).toEqual(["strona"]);
    expect(found[0]?.href).toBe("/szkola/warsztaty");
    expect(found[0]?.publishedOn).toBeNull();
    expect(await search.search([["lodzk"]], 10)).toHaveLength(1);
    expect(await search.search([["odznaki"]], 10)).toHaveLength(1);
    expect(await search.search([["samolot"]], 10)).toHaveLength(1);
    expect(await search.search([["zapisz"]], 10)).toHaveLength(1);
    expect(await search.search([["wniosek"]], 10)).toHaveLength(1);

    await repo.save(page("/szkola/warsztaty"), "draft");
    expect(await search.search([["warsztat"]], 10)).toEqual([]);
  });
});

describe("reindex", () => {
  it("rebuilds every published document and is idempotent", async ({ expect }) => {
    const db = memoryDatabase();
    const one = store(db);
    const repo = searchRepo(one);
    await newsRepo(one).save(news("a", { title: "Łódzkie aktualności" }), "published");
    await pagesRepo(one).save(page("/szkola/warsztaty"), "published");
    await newsRepo(one).save(news("drafted", { title: "Łódzkie szkice" }), "draft");
    db.sqlite.exec("DELETE FROM search_documents");

    await reindex(one);
    const first = await repo.search([["lodz"]], 10);
    expect(first.map((doc) => doc.href).toSorted()).toEqual([
      "/aktualnosci/2026/a",
      "/szkola/warsztaty",
    ]);

    await reindex(one);
    const second = await repo.search([["lodz"]], 10);
    expect(second).toEqual(first);
    expect(db.sqlite.prepare("SELECT count(*) AS total FROM search_documents").get()).toEqual({
      total: 2,
    });
  });
});
