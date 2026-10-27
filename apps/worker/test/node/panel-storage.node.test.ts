import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { clampedLimit, auditRepo } from "../../src/storage/audit-repo.ts";
import type { Store } from "../../src/storage/database.ts";
import { revisionsRepo } from "../../src/storage/revisions-repo.ts";
import { normaliseEmail, staffRepo, staffSchema } from "../../src/storage/staff-repo.ts";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("email helpers", () => {
  it("normalises panel actors", ({ expect }) => {
    expect(normaliseEmail("  Sekretariat@ZSM3.pl ")).toBe("sekretariat@zsm3.pl");
  });
});

describe("staff repository", () => {
  it("saves, reads and deactivates staff members", async ({ expect }) => {
    const repo = staffRepo(store());
    await repo.save({ email: "Admin@ZSM3.pl", role: "admin", active: true });
    await repo.save({ email: "edytor@zsm3.pl", role: "gallery_editor", active: false });

    expect(await repo.get("admin@zsm3.pl")).toEqual({
      email: "admin@zsm3.pl",
      role: "admin",
      active: true,
      createdAt: "2026-10-22T08:00:00.000Z",
      updatedAt: "2026-10-22T08:00:00.000Z",
    });
    expect((await repo.get("admin@zsm3.pl "))?.email).toBe("admin@zsm3.pl");
    expect(await repo.get("nie-ma@zsm3.pl")).toBeUndefined();
    expect((await repo.list()).map((member) => member.role)).toEqual(["admin", "gallery_editor"]);
  });

  it("updates roles in place and keeps the first created_at", async ({ expect }) => {
    const db = memoryDatabase();
    const repo = staffRepo({ db, clock: FIXED_CLOCK, random: counterRandom() });
    await repo.save({ email: "sekretariat@zsm3.pl", role: "secretariat", active: true });
    await repo.save({ email: "sekretariat@zsm3.pl", role: "gallery_editor", active: false });

    expect(await repo.get("SEKRETARIAT@zsm3.pl")).toMatchObject({
      role: "gallery_editor",
      active: false,
    });
    const stored = db.sqlite.prepare("SELECT created_at, updated_at FROM staff").get();
    expect(stored).toEqual({
      created_at: "2026-10-22T08:00:00.000Z",
      updated_at: "2026-10-22T08:00:00.000Z",
    });
  });

  it("rejects unknown roles and malformed emails", async ({ expect }) => {
    const repo = staffRepo(store());

    expect(
      staffSchema.safeParse({ email: "admin@zsm3.pl", role: "dyrektor", active: true }).success,
    ).toBe(false);
    await expect(repo.save({ email: "brak-at", role: "admin", active: true })).rejects.toThrow();
  });
});

describe("audit repository", () => {
  it("appends records with generated ids and lists them newest first", async ({ expect }) => {
    const db = store();
    const repo = auditRepo(db);
    await repo.append({
      actorEmail: "admin@zsm3.pl",
      action: "news.publish",
      entity: "news",
      entityId: "salon",
      details: '{"title":"Salon"}',
    });
    await repo.append({
      actorEmail: null,
      action: "page.update",
      entity: "pages",
      entityId: "/kontakt",
      details: "{}",
    });

    const records = await repo.list(10);
    const first = records[0];
    if (first === undefined) {
      throw new Error("fixture");
    }
    expect(first).toMatchObject({
      at: "2026-10-22T08:00:00.000Z",
      actorEmail: null,
      action: "page.update",
      entity: "pages",
      entityId: "/kontakt",
      details: "{}",
    });
    expect(first.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);
    expect(records[1]).toEqual(
      expect.objectContaining({ actorEmail: "admin@zsm3.pl", action: "news.publish" }),
    );
    expect(await repo.list(0)).toHaveLength(1);
  });

  it("filters by entity and caps the limit", async ({ expect }) => {
    const repo = auditRepo(store());
    await repo.append({
      actorEmail: null,
      action: "news.publish",
      entity: "news",
      entityId: "salon",
      details: "{}",
    });
    await repo.append({
      actorEmail: null,
      action: "news.publish",
      entity: "news",
      entityId: "dnia",
      details: '{"a":1}',
    });
    await repo.append({
      actorEmail: null,
      action: "page.update",
      entity: "pages",
      entityId: "salon",
      details: "{}",
    });

    expect((await repo.byEntity("news", "salon", 100)).map((record) => record.entityId)).toEqual([
      "salon",
    ]);
    expect(clampedLimit(500)).toBe(100);
    expect(clampedLimit(0)).toBe(1);
    expect(clampedLimit(50)).toBe(50);
  });

  it("rejects malformed entries before storage", async ({ expect }) => {
    const repo = auditRepo(store());

    await expect(
      repo.append({ actorEmail: "x@", action: "", entity: "news", entityId: "n", details: "{}" }),
    ).rejects.toThrow();
  });
});

describe("revisions repository", () => {
  it("numbers revisions per entity and reads the history", async ({ expect }) => {
    const repo = revisionsRepo(store());
    await repo.append("news", "salon", '{"v":1}', "admin@zsm3.pl");
    await repo.append("news", "salon", '{"v":2}', "admin@zsm3.pl");
    await repo.append("pages", "salon", '{"v":1}', "admin@zsm3.pl");

    const latest = await repo.latest("news", "salon");
    expect(latest).toMatchObject({
      entity: "news",
      entityId: "salon",
      revision: 2,
      dataJson: '{"v":2}',
      actorEmail: "admin@zsm3.pl",
      at: "2026-10-22T08:00:00.000Z",
    });
    expect((await repo.list("news", "salon")).map((item) => item.revision)).toEqual([1, 2]);
    expect((await repo.list("pages", "salon")).map((item) => item.revision)).toEqual([1]);
  });

  it("answers without revisions", async ({ expect }) => {
    const repo = revisionsRepo(store());

    expect(await repo.latest("news", "salon")).toBeUndefined();
    expect(await repo.list("news", "salon")).toEqual([]);
  });

  it("rejects invalid revisions", async ({ expect }) => {
    const repo = revisionsRepo(store());

    await expect(repo.append("", "salon", "{}", "admin@zsm3.pl")).rejects.toThrow();
  });
});
