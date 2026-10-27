import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { newsBody, pageSections } from "./search-backfill-fixtures.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { newsDocument, newsFromRow, newsRowSchema } from "../src/storage/news-repo.ts";
import { pageDocument, pageFromRow, pageRowSchema } from "../src/storage/pages-repo.ts";
import { searchRepo } from "../src/storage/search-repo.ts";

const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };
const backfillName = "0003_search_index_backfill.sql";

beforeAll(async () => {
  const migrationNames = env.TEST_MIGRATIONS.map((migration) => migration.name);
  const indexPosition = migrationNames.indexOf("0003_search_index.sql");
  const backfillPosition = migrationNames.indexOf(backfillName);
  if (indexPosition < 0 || backfillPosition !== indexPosition + 1) {
    throw new Error("D1 search backfill must follow the search index migration");
  }
  const requestsPosition = migrationNames.indexOf("0004_requests.sql");
  if (requestsPosition !== backfillPosition + 1) {
    throw new Error("D1 search backfill must precede the requests migration");
  }
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.slice(0, backfillPosition));
  for (const [id, slug, status] of [
    ["published", "archiwum", "published"],
    ["older", "starsze", "published"],
    ["draft", "szkic", "draft"],
  ]) {
    await env.DB.prepare(
      `INSERT INTO news
      (id, slug, published_on, category, title, lead, body_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        slug,
        "2025-09-01",
        "Lotnictwo",
        "Łódzkie warsztaty",
        "Praktyka w szkole",
        JSON.stringify(newsBody),
        status,
        "2025-09-01T00:00:00Z",
        "2025-09-01T00:00:00Z",
      )
      .run();
  }
  for (const [path, status] of [
    ["/szkola/archiwum", "published"],
    ["/szkola/szkic", "draft"],
  ]) {
    await env.DB.prepare(
      `INSERT INTO pages
      (path, kicker, title, intro, sections_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        path,
        "Szkoła",
        "Łódzkie pracownie",
        "Pracownie szkoły",
        JSON.stringify(pageSections),
        status,
        "2025-09-01T00:00:00Z",
        "2025-09-01T00:00:00Z",
      )
      .run();
  }
  await searchRepo(store).index({
    docId: "n:published",
    kind: "aktualnosc",
    href: "/aktualnosci/2025/archiwum",
    title: "Aktualne warsztaty",
    body: "Samoloty",
    publishedOn: "2025-09-01",
  });
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("search backfill on existing D1", () => {
  it("runs search index, backfill and requests migrations in order", async ({ expect }) => {
    const names = env.TEST_MIGRATIONS.map((migration) => migration.name);
    expect(names).toEqual(names.toSorted());
    expect(names.indexOf(backfillName)).toBe(names.indexOf("0003_search_index.sql") + 1);
    expect(names.indexOf("0004_requests.sql")).toBe(names.indexOf(backfillName) + 1);
    const requests = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = ?")
      .bind("requests")
      .first();
    expect(requests).toEqual({ name: "requests" });
  });

  it("indexes existing published pages and news, without overwriting newer indexed content", async ({
    expect,
  }) => {
    const repo = searchRepo(store);
    expect((await repo.search([["aktualne"]], 10)).map((doc) => doc.docId)).toEqual([
      "n:published",
    ]);
    expect((await repo.search([["praktyka"]], 10)).map((doc) => doc.docId)).toEqual(["n:older"]);
    expect((await repo.search([["lodzk"]], 10)).map((doc) => doc.docId).toSorted()).toEqual([
      "n:older",
      "p:/szkola/archiwum",
    ]);
    expect((await repo.search([["silniki"]], 10)).map((doc) => doc.href)).toEqual([
      "/szkola/archiwum",
    ]);
    expect(await repo.search([["szkic"]], 10)).toEqual([]);
    expect((await repo.search([["samolot"]], 10)).map((doc) => doc.docId).toSorted()).toEqual([
      "n:older",
      "n:published",
      "p:/szkola/archiwum",
    ]);
    for (const term of [
      "pomiary",
      "element",
      "wirnik",
      "pracownia",
      "przeglad",
      "badania",
      "instruktazowy",
    ]) {
      expect(
        (await repo.search([[term]], 10)).map((doc) => doc.href),
        term,
      ).toContain("/aktualnosci/2025/starsze");
    }
    for (const term of [
      "zestawienie",
      "czesc",
      "turbina",
      "nagranie",
      "stanowiska",
      "montaz",
      "schemat",
    ]) {
      expect(
        (await repo.search([[term]], 10)).map((doc) => doc.href),
        term,
      ).toContain("/szkola/archiwum");
    }
  });

  it("joins formatted inline words and matches repository documents for older news and nested pages", async ({
    expect,
  }) => {
    const newsRow = await env.DB.prepare(
      "SELECT slug, published_on, category, title, lead, body_json, cover_caption, cover_credit FROM news WHERE id = ?",
    )
      .bind("older")
      .first();
    const pageRow = await env.DB.prepare(
      "SELECT path, kicker, title, intro, sections_json FROM pages WHERE path = ?",
    )
      .bind("/szkola/archiwum")
      .first();
    const news = newsDocument("older", newsFromRow(newsRowSchema.parse(newsRow)));
    const page = pageDocument(pageFromRow(pageRowSchema.parse(pageRow)));
    const repo = searchRepo(store);

    expect((await repo.search([["samoloty"]], 10)).map((doc) => doc.docId)).toContain("n:older");
    expect((await repo.search([["samoloty"]], 10)).map((doc) => doc.docId)).toContain(
      "p:/szkola/archiwum",
    );
    expect(await repo.search([["samoloty"], ["wirnik"]], 10)).toContainEqual(news);
    expect(await repo.search([["samoloty"], ["turbina"]], 10)).toContainEqual(page);
  });
});
