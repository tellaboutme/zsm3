import { afterEach, describe, it, vi } from "vitest";

import { indexNowSession, publishedSalon, SALON, SALON_API_PATH } from "./indexnow-spy.ts";
import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { newsSaveMutation } from "./panel-fixtures.ts";
import { panelJsonCall } from "./panel-support.ts";
import { auditRepo } from "../../src/storage/audit-repo.ts";
import type { SqlDatabase, Store } from "../../src/storage/database.ts";
import { revisionsRepo } from "../../src/storage/revisions-repo.ts";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

const ENTRY = {
  actorEmail: "admin@zsm3.pl",
  action: "news.update",
  entity: "news",
  entityId: "2026/salon",
  details: "{}",
};

const SNAPSHOT = {
  entity: "news",
  entityId: "2026/salon",
  dataJson: '{"v":1}',
  actorEmail: "admin@zsm3.pl",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("current revision number", () => {
  it("is 0 for an item without revisions and counts each later one", async ({ expect }) => {
    const repo = revisionsRepo(store());
    const missing = await repo.current("news", "2026/salon");
    await repo.append("news", "2026/salon", '{"v":1}', "admin@zsm3.pl");
    const initial = await repo.current("news", "2026/salon");
    await repo.append("news", "2026/salon", '{"v":2}', "admin@zsm3.pl");
    await repo.append("news", "2026/salon", '{"v":3}', "admin@zsm3.pl");
    await repo.append("pages", "2026/salon", '{"v":1}', "admin@zsm3.pl");

    expect([missing, initial, await repo.current("news", "2026/salon")]).toEqual([0, 1, 3]);
    expect(await repo.current("news", "2026/inny")).toBe(0);
  });
});

describe("write receipts", () => {
  it("find a revision row only after its own batch committed", async ({ expect }) => {
    const live = store();
    const repo = revisionsRepo(live);
    const first = repo.expectedWrite({ ...SNAPSHOT, expected: 0 });
    const stale = repo.expectedWrite({ ...SNAPSHOT, expected: 0 });
    const pending = await first.landed();
    await live.db.batch([first.statement]);

    await expect(live.db.batch([stale.statement])).rejects.toThrow();
    expect([pending, await first.landed(), await stale.landed()]).toEqual([false, true, false]);
  });

  it("find an audit row only after its own batch committed", async ({ expect }) => {
    const live = store();
    const audit = auditRepo(live);
    const mine = audit.receipt(ENTRY);
    const other = audit.receipt(ENTRY);
    const pending = await mine.landed();
    await live.db.batch([mine.statement]);

    expect([pending, await mine.landed(), await other.landed()]).toEqual([false, true, false]);
  });
});

it("surfaces the write error when its outcome cannot be established", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const session = await indexNowSession();
  await publishedSalon(session);
  const memory = session.harness.env.DB;
  let broken = false;
  const DB: SqlDatabase = {
    prepare: (query) => {
      if (broken) {
        throw Object.assign(new Error("recheck"), { name: "RecheckFailed" });
      }
      return memory.prepare(query);
    },
    batch: async () => {
      broken = true;
      return Promise.reject(Object.assign(new Error("lost"), { name: "BatchLost" }));
    },
  };

  const edited = await panelJsonCall(
    { ...session.harness, env: { ...session.harness.env, DB } },
    "PUT",
    SALON_API_PATH,
    { token: session.token, body: newsSaveMutation({ ...SALON, lead: "Poprawka." }, 1) },
  );

  expect(edited.status).toBe(500);
  expect(session.pegs).toEqual([]);
  expect(logged.mock.calls.flat().join("\n")).toContain('"errorName":"BatchLost"');
});

it("recovers a committed write whose driver rejected without an Error", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const session = await indexNowSession();
  await publishedSalon(session);
  const memory = session.harness.env.DB;
  const lost = vi.fn<() => Promise<unknown>>().mockRejectedValue("driver");
  const DB: SqlDatabase = {
    prepare: (query) => memory.prepare(query),
    batch: async (statements) => {
      await memory.batch(statements);
      return lost();
    },
  };

  const edited = await panelJsonCall(
    { ...session.harness, env: { ...session.harness.env, DB } },
    "PUT",
    SALON_API_PATH,
    { token: session.token, body: newsSaveMutation({ ...SALON, lead: "Poprawka." }, 1) },
  );

  expect(edited.status).toBe(200);
  expect(logged.mock.calls).toEqual([
    [JSON.stringify({ event: "panel_write_recovered", errorName: "unknown" })],
  ]);
});

it("answers a conflict without logging when another write landed first", async ({ expect }) => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const session = await indexNowSession();
  await publishedSalon(session);
  const memory = session.harness.env.DB;
  let pending = true;
  const DB: SqlDatabase = {
    prepare: (query) => memory.prepare(query),
    batch: async (statements) => {
      if (pending) {
        pending = false;
        await panelJsonCall(session.harness, "PUT", SALON_API_PATH, {
          token: session.token,
          body: newsSaveMutation({ ...SALON, lead: "Poprawka B." }, 1),
        });
      }
      return memory.batch(statements);
    },
  };

  const edited = await panelJsonCall(
    { ...session.harness, env: { ...session.harness.env, DB } },
    "PUT",
    SALON_API_PATH,
    { token: session.token, body: newsSaveMutation({ ...SALON, lead: "Poprawka A." }, 1) },
  );

  expect(edited.status).toBe(409);
  expect(await edited.json()).toMatchObject({ title: "Content Changed" });
  expect(logged.mock.calls).toEqual([]);
});
