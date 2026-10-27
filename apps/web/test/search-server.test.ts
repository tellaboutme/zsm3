import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from "@zsm3/contracts/problem";
import type { SearchDocument } from "@zsm3/contracts/search";
import { searchResponseSchema, searchTextMaxLength } from "@zsm3/contracts/search";
import type { SqlDatabase, SqlStatement } from "@zsm3/worker/storage/database.ts";
import type { SearchTerms } from "@zsm3/worker/storage/search-repo.ts";
import { describe, it, vi } from "vitest";

import { datasetRow, staticSearchEntries } from "./search-fixtures.ts";
import {
  FTS_RESULTS_LIMIT,
  matchGroups,
  mergeResults,
  SEARCH_RESULTS_LIMIT,
  searchEndpoint,
  searchResponse,
  type SearchBackend,
} from "../src/lib/search-server.ts";
import { prepare, type SearchEntry } from "../src/lib/search.ts";
import { ON_DEMAND_CACHE, sitePageHeaders, withHeaders } from "../src/lib/security-headers.ts";

const db = vi.hoisted(() => {
  const statement = (query: string, values: readonly unknown[]): SqlStatement => ({
    bind: (...next) => statement(query, next),
    all: async () => Promise.resolve({ results: [] }),
    first: async () => Promise.resolve(datasetRow(query, values)),
    run: async () => Promise.resolve(undefined),
  });
  const database: SqlDatabase = {
    prepare: (query) => statement(query, []),
    batch: async () => Promise.resolve([]),
  };
  return database;
});

vi.mock("cloudflare:workers", () => ({ env: { DB: db } }));

const entry = (
  type: SearchEntry["type"],
  title: string,
  href: string,
  text = "opis",
): SearchEntry => ({ type, title, href, text });

const document = (href: string, title: string, body: string): SearchDocument => ({
  docId: `p:${href}`,
  kind: "strona",
  href,
  title,
  body,
  publishedOn: null,
});

const prepared = prepare([entry("strona", "Kontakt", "/kontakt", "sekretariat telefon")]);

const stubBackend = (documents: readonly SearchDocument[]): SearchBackend => ({
  index: prepared,
  requestId: "0199f2a4-1c2b-7d3e-8f40-1234567890ab",
  find: async () => Promise.resolve(documents),
});

describe("matchGroups", () => {
  it("expands terms with their synonym groups", ({ expect }) => {
    expect(matchGroups("lotnictwo i 4tp")).toEqual([
      ["lotnictwo", "lotniczy", "samolot", "awionik", "lotnisko"],
      ["4tp"],
    ]);
    expect(matchGroups("legitymacja szkolna")).toEqual([["legitymacja", "duplikat"], ["szkolna"]]);
  });

  it("finds synonyms through the stem and skips words without synonyms", ({ expect }) => {
    expect(matchGroups("samoloty")).toEqual([
      ["samoloty", "lotnictwo", "lotniczy", "samolot", "awionik", "lotnisko"],
    ]);
    expect(matchGroups("x")).toEqual([]);
  });
});

describe("mergeResults", () => {
  it("prefers current indexed content, deduplicates by href and caps the results", ({ expect }) => {
    const merged = mergeResults(
      [entry("strona", "Stary kontakt", "/kontakt")],
      [
        entry("strona", "Aktualny kontakt", "/kontakt"),
        entry("aktualnosc", "News", "/aktualnosci/2026/a"),
      ],
    );

    expect(merged.map((item) => item.title)).toEqual(["Aktualny kontakt", "News"]);
    expect(SEARCH_RESULTS_LIMIT).toBe(50);
    expect(FTS_RESULTS_LIMIT).toBe(50);
    const many = [...Array.from({ length: 60 }).keys()].map((index) =>
      entry("strona", `Strona ${String(index)}`, `/strona-${String(index)}`),
    );
    expect(mergeResults(many, [])).toHaveLength(SEARCH_RESULTS_LIMIT);
  });
});

describe("searchResponse", () => {
  it("keeps a matching school event beside indexed news for exam searches", ({ expect }) => {
    const results = searchResponse(prepare(staticSearchEntries), "egzamin", [
      document("/aktualnosci/2026/salon", "Salon maturalny", "Egzamin."),
    ]).results;

    expect(results.map((result) => result.title)).toContain(
      "Egzamin zawodowy, sesja zimowa: część pisemna",
    );
  });

  it("merges scored and indexed documents into the response schema", ({ expect }) => {
    const response = searchResponse(prepared, "kontakt", [
      document("/aktualnosci/2026/salon", "Salon maturalny", "Egzamin."),
    ]);

    expect(response.results.map((result) => result.href)).toEqual([
      "/aktualnosci/2026/salon",
      "/kontakt",
    ]);
  });

  it("suggests a correction only when nothing is found", ({ expect }) => {
    const index = prepare([
      entry("strona", "Legitymacja", "/uczniowie/wzory-dokumentow", "duplikat"),
    ]);

    expect(searchResponse(index, "legitymcjaaa", []).suggestion).toBe("legitymacja");
    expect(searchResponse(index, "legitymacja", []).suggestion).toBeUndefined();
  });
});

describe("searchEndpoint", () => {
  it("answers 400 problem json for a missing, short or oversized query", async ({ expect }) => {
    for (const q of [undefined, "x", "x".repeat(201)]) {
      const params = new URLSearchParams();
      if (q !== undefined) {
        params.set("q", q);
      }
      const response = await searchEndpoint(params, stubBackend([]));

      expect(response.status, q).toBe(400);
      expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
      expect(problemDetailsSchema.parse(await response.json()).status).toBe(400);
    }
  });

  it("trims the query, expands synonyms and merges results into json", async ({ expect }) => {
    const calls: SearchTerms[] = [];
    const backend: SearchBackend = {
      index: prepared,
      requestId: "0199f2a4-1c2b-7d3e-8f40-1234567890ab",
      find: async (terms) => {
        calls.push(terms);
        return Promise.resolve([
          document("/aktualnosci/2026/salon", "Salon maturalny", "Egzamin."),
        ]);
      },
    };

    const response = await searchEndpoint(new URLSearchParams("q=+legitymacja+"), backend);
    const payload = searchResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(calls).toEqual([[["legitymacja", "duplikat"]]]);
    expect(payload.results.map((result) => result.href)).toEqual(["/aktualnosci/2026/salon"]);
  });

  it("truncates an oversized document body to the contract limit", async ({ expect }) => {
    const oversized = "a".repeat(searchTextMaxLength + 1);
    const response = await searchEndpoint(
      new URLSearchParams("q=kontakt"),
      stubBackend([document("/duzy", "Duży dokument", oversized)]),
    );
    const payload = searchResponseSchema.parse(await response.json());
    const large = payload.results.find((result) => result.href === "/duzy");

    expect(response.status).toBe(200);
    expect(large?.text).toBe(oversized.slice(0, searchTextMaxLength));
  });
});

describe("wyniki endpoint", () => {
  it("answers GET only with json results", async ({ expect }) => {
    const endpoint = await import("../src/pages/szukaj/wyniki.json.ts");

    expect(endpoint.prerender).toBe(false);
    expect(Object.hasOwn(endpoint, "POST")).toBe(false);
    expect(Object.hasOwn(endpoint, "PUT")).toBe(false);
    expect(Object.hasOwn(endpoint, "DELETE")).toBe(false);
    const response = await endpoint.GET({
      url: new URL("https://zsm3.test/szukaj/wyniki.json?q=dzwonki"),
    });
    const payload = searchResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(payload.results.some((result) => result.href === "/uczniowie/dzwonki")).toBe(true);
  });

  it("answers a problem for an invalid query", async ({ expect }) => {
    const endpoint = await import("../src/pages/szukaj/wyniki.json.ts");

    const response = await endpoint.GET({
      url: new URL("https://zsm3.test/szukaj/wyniki.json?q=x"),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(problemDetailsSchema.parse(await response.json()).status).toBe(400);
  });

  it("composes with the security headers applied by the middleware", async ({ expect }) => {
    const endpoint = await import("../src/pages/szukaj/wyniki.json.ts");

    const response = await endpoint.GET({
      url: new URL("https://zsm3.test/szukaj/wyniki.json?q=kontakt"),
    });
    const secured = withHeaders(response, await sitePageHeaders());

    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(secured.headers.get("Content-Security-Policy")).toMatch(/^default-src 'none'/u);
    expect(secured.headers.get("Cache-Control")).toBe(ON_DEMAND_CACHE);
  });
});
