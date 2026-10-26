import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { cryptoRandom } from "../src/storage/ids.ts";
import { searchRepo } from "../src/storage/search-repo.ts";

const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("search on D1", () => {
  it("registers the fts5 module and folds Polish text with unicode61", async ({ expect }) => {
    const repo = searchRepo(store);
    await repo.index({
      docId: "p:fts-diacritics",
      kind: "strona",
      href: "/szkola/warsztaty",
      title: "Łódzkie warsztaty",
      body: "Zajęcia o samolotach i legitymacjach.",
      publishedOn: null,
    });

    const found = await repo.search([["lodzk"]], 10);
    expect(found.map((doc) => doc.docId)).toEqual(["p:fts-diacritics"]);
    expect(found[0]?.title).toBe("Łódzkie warsztaty");
    expect(found[0]?.body).toBe("Zajęcia o samolotach i legitymacjach.");
  });

  it("ranks title matches above body matches with bm25", async ({ expect }) => {
    const repo = searchRepo(store);
    await repo.index({
      docId: "n:fts-title",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/tytul",
      title: "salon maturalny",
      body: "cos innego",
      publishedOn: "2026-09-01",
    });
    await repo.index({
      docId: "n:fts-body",
      kind: "aktualnosc",
      href: "/aktualnosci/2026/tresc",
      title: "cos innego",
      body: "salon maturalny",
      publishedOn: "2026-09-02",
    });

    const found = await repo.search([["maturaln"]], 10);
    expect(found.map((doc) => doc.docId)).toEqual(["n:fts-title", "n:fts-body"]);
  });

  it("removes documents by doc_id", async ({ expect }) => {
    const repo = searchRepo(store);
    await repo.index({
      docId: "p:fts-removal",
      kind: "strona",
      href: "/szkola/do-usuniecia",
      title: "Łódzkie ogłoszenie",
      body: "Treść.",
      publishedOn: null,
    });
    expect((await repo.search([["lodzk"]], 10)).some((doc) => doc.docId === "p:fts-removal")).toBe(
      true,
    );

    await repo.remove("p:fts-removal");
    expect((await repo.search([["lodzk"]], 10)).some((doc) => doc.docId === "p:fts-removal")).toBe(
      false,
    );
  });
});
