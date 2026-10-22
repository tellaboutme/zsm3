import type { News, SchoolEvent } from "@zsm3/contracts/content";
import { describe, it } from "vitest";
import { z } from "zod";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import {
  allRows,
  firstRow,
  liveStore,
  systemClock,
  timestamp,
  type Store,
} from "../../src/storage/database.ts";
import { eventsRepo } from "../../src/storage/events-repo.ts";
import { cryptoRandom, uuidv7 } from "../../src/storage/ids.ts";
import { newsRepo } from "../../src/storage/news-repo.ts";
import { pagesRepo } from "../../src/storage/pages-repo.ts";
import { normalisePath, redirectsRepo } from "../../src/storage/redirects-repo.ts";

const body = [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Treść." }] }];

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

function news(slug: string, date: string, category = "Sport"): News {
  return { slug, date, category, title: `Tytuł ${slug}`, lead: "Lead.", body };
}

describe("identifiers", () => {
  it("builds version 7 UUIDs that sort by time", ({ expect }) => {
    const random = (length: number): Uint8Array => new Uint8Array(length).fill(0xff);
    const first = uuidv7(1_700_000_000_000, random);

    expect(first).toBe("018bcfe5-6800-7fff-bfff-ffffffffffff");
    expect(uuidv7(0, (length) => new Uint8Array(length))).toBe(
      "00000000-0000-7000-8000-000000000000",
    );
    expect(uuidv7(1_700_000_000_001, random) > first).toBe(true);
  });

  it("draws randomness from the platform", ({ expect }) => {
    expect(cryptoRandom(10)).toHaveLength(10);
    expect(uuidv7(Date.now(), cryptoRandom)).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u,
    );
  });
});

describe("database helpers", () => {
  it("formats timestamps and validates rows", async ({ expect }) => {
    const db = memoryDatabase();
    const schema = z.object({ value: z.number() });

    expect(timestamp(FIXED_CLOCK)).toBe("2026-10-22T08:00:00.000Z");
    expect(await allRows(db.prepare("SELECT 1 AS value"), schema)).toEqual([{ value: 1 }]);
    expect(await firstRow(db.prepare("SELECT 2 AS value"), schema)).toEqual({ value: 2 });
    expect(await firstRow(db.prepare("SELECT 1 AS value WHERE 0"), schema)).toBeUndefined();
    await expect(firstRow(db.prepare("SELECT 'x' AS value"), schema)).rejects.toThrow();
  });

  it("builds a live store on the system clock and platform randomness", ({ expect }) => {
    const db = memoryDatabase();
    const before = Date.now();

    const live = liveStore(db);

    expect(live).toEqual({ db, clock: systemClock, random: cryptoRandom });
    expect(live.clock().getTime()).toBeGreaterThanOrEqual(before);
    expect(live.clock().getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("rolls back a failing batch", async ({ expect }) => {
    const db = memoryDatabase();
    const insert = db.prepare(
      "INSERT INTO redirects (from_path, to_path, created_at) VALUES (?, ?, 'now')",
    );

    await expect(db.batch([insert.bind("/a", "/b"), insert.bind("/a", "/c")])).rejects.toThrow();
    expect(db.sqlite.prepare("SELECT count(*) AS total FROM redirects").get()).toEqual({
      total: 0,
    });
  });
});

describe("news repository", () => {
  it("stores, updates and reads published news newest first", async ({ expect }) => {
    const repo = newsRepo(store());
    await repo.save(news("a", "2026-09-01"), "published");
    await repo.save(news("b", "2026-10-01", "Zdrowie"), "published");
    await repo.save(news("c", "2025-05-01"), "published");
    await repo.save(news("d", "2026-10-05"), "draft");
    await repo.save({ ...news("a", "2026-09-02"), cover: { caption: "Zdjęcie" } }, "published");

    expect((await repo.published({}, { limit: 10, offset: 0 })).map((item) => item.slug)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(
      await repo.published({ year: "2026", category: "Sport" }, { limit: 10, offset: 0 }),
    ).toEqual([{ ...news("a", "2026-09-02"), cover: { caption: "Zdjęcie" } }]);
    expect(await repo.published({}, { limit: 1, offset: 1 })).toHaveLength(1);
    expect(await repo.countPublished({})).toBe(3);
    expect(await repo.countPublished({ category: "Zdrowie" })).toBe(1);
    expect(await repo.categories()).toEqual(["Sport", "Zdrowie"]);
    expect(await repo.years()).toEqual(["2026", "2025"]);
  });

  it("finds an article by year and slug, never a draft", async ({ expect }) => {
    const repo = newsRepo(store());
    const item = { ...news("salon", "2026-09-22"), cover: { caption: "Salon", credit: "ZSM3" } };
    await repo.save(item, "published");
    await repo.save(news("szkic", "2026-09-23"), "draft");

    expect(await repo.find("2026", "salon")).toEqual(item);
    expect(await repo.find("2025", "salon")).toBeUndefined();
    expect(await repo.find("2026", "szkic")).toBeUndefined();
  });

  it("rejects invalid news before it reaches the database", async ({ expect }) => {
    const repo = newsRepo(store());

    await expect(repo.save(news("Zły slug", "2026-09-01"), "published")).rejects.toThrow();
  });
});

describe("events repository", () => {
  const events: SchoolEvent[] = [
    {
      date: "2026-12-23",
      endDate: "2026-12-31",
      title: "Przerwa",
      audience: "Wszyscy",
      kind: "przerwa",
      key: true,
    },
    {
      date: "2026-11-18",
      title: "Zebranie",
      audience: "Rodzice",
      kind: "zebranie",
      note: "Godz. 17:00.",
    },
  ];

  it("replaces a school year and reads it in date order", async ({ expect }) => {
    const [first, second] = events;
    if (first === undefined || second === undefined) {
      throw new Error("fixture");
    }
    const repo = eventsRepo(store());
    await repo.replaceYear("2026-09-01", "2027-08-31", [{ ...first, title: "Stara" }]);
    await repo.replaceYear("2026-09-01", "2027-08-31", events);

    expect(await repo.between("2026-09-01", "2027-08-31")).toEqual([second, first]);
    expect(await repo.between("2027-01-01", "2027-08-31")).toEqual([]);
  });
});

describe("pages repository", () => {
  const page = {
    path: "/szkola/historia",
    kicker: "Szkoła",
    title: "Historia",
    intro: "Od 1950 roku.",
    sections: [
      {
        id: "poczatki",
        title: "Początki",
        blocks: [{ type: "rich-text" as const, document: body }],
      },
    ],
  };

  it("publishes pages and hides drafts", async ({ expect }) => {
    const repo = pagesRepo(store());
    await repo.save(page, "published");
    await repo.save({ ...page, path: "/szkola/patron", title: "Patron" }, "draft");
    await repo.save({ ...page, intro: "Zmieniony wstęp." }, "published");

    expect(await repo.find("/szkola/historia")).toEqual({ ...page, intro: "Zmieniony wstęp." });
    expect(await repo.find("/szkola/patron")).toBeUndefined();
    expect(await repo.publishedPaths()).toEqual(["/szkola/historia"]);
  });
});

describe("redirects repository", () => {
  it("normalises old addresses", ({ expect }) => {
    expect(normalisePath("/Wywiadowki/")).toBe("/wywiadowki");
    expect(normalisePath("/")).toBe("/");
    expect(normalisePath("/a")).toBe("/a");
  });

  it("resolves old addresses to new pages", async ({ expect }) => {
    const repo = redirectsRepo(store());
    await repo.save({ from: "/wywiadowki/", to: "/rodzice/wywiadowki" });
    await repo.save({ from: "/wywiadowki", to: "/rodzice/wywiadowki-2" });

    expect(await repo.target("/WYWIADOWKI/")).toBe("/rodzice/wywiadowki-2");
    expect(await repo.target("/nie-ma")).toBeUndefined();
  });
});
