import { describe, it } from "vitest";
import { z } from "zod";

import { counterRandom } from "./memory-database.ts";
import {
  at,
  attempt,
  CODE,
  DAY,
  failureRows,
  HOUR,
  KEY,
  RIGHT,
  seed,
  seedFailures,
  START,
  store,
} from "./short-link-daily-support.ts";
import { spyBucket } from "./short-link-files-support.ts";
import { runHousekeeping } from "../../src/jobs/housekeeping.ts";
import { sha256 } from "../../src/security/hmac.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import { openLink } from "../../src/short-links/resolve.ts";
import {
  DAILY_FAILED_ATTEMPTS,
  FAILURE_PRUNE_BATCH,
  FAILURE_WINDOW_MS,
  shortLinkFailuresRepo,
} from "../../src/storage/short-link-failures-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

describe("stored failure records", () => {
  it("hands out exactly one hundred slots a day and takes a released one back", async ({
    expect,
  }) => {
    const failures = shortLinkFailuresRepo(store());
    const slots: (number | undefined)[] = [];
    for (let index = 0; index < DAILY_FAILED_ATTEMPTS + 1; index += 1) {
      slots.push(await failures.reserve(CODE, START));
    }

    expect(new Set(slots.slice(0, DAILY_FAILED_ATTEMPTS)).size).toBe(DAILY_FAILED_ATTEMPTS);
    expect(
      slots.every((slot, index) => index < DAILY_FAILED_ATTEMPTS === (slot !== undefined)),
    ).toBe(true);
    await failures.release(slots[0] ?? 0);
    await expect(failures.reserve(CODE, START)).resolves.toBeTypeOf("number");
    await expect(failures.reserve(CODE, START)).resolves.toBeUndefined();
  });

  it("are pruned once older than the window, in bounded batches", async ({ expect }) => {
    const current = store();
    await seedFailures(current, 3, at(START, -1));
    await seedFailures(current, 2, START);
    await seedFailures(current, 1, at(START, HOUR));

    await shortLinkFailuresRepo(current).prune(at(START, DAY), 1);
    await expect(failureRows(current)).resolves.toBe(5);
    await runHousekeeping(current, spyBucket(), at(START, DAY));
    await expect(failureRows(current)).resolves.toBe(3);
    expect([FAILURE_WINDOW_MS, FAILURE_PRUNE_BATCH]).toEqual([DAY, 1000]);
  });

  it("hold the link code and time only, never a visitor", async ({ expect }) => {
    const current = store();
    const columns = await current.db.prepare("PRAGMA table_info(short_link_failures)").all();

    const names = z.array(z.object({ name: z.string() })).parse(columns.results);

    expect(names.map((column) => column.name)).toEqual(["id", "code", "attempted_at"]);
  });
});

describe("compatibility with links issued before the change", () => {
  it("still unlocks a link whose password predates the twelve-character rule", async ({
    expect,
  }) => {
    const current = store();
    await shortLinksRepo(current).create({
      code: CODE,
      target: "https://example.org/materialy",
      password: await hashPassword(KEY, "zsm3-demo", counterRandom()),
      createdBy: "nauczyciel@zsm3.test",
      expiresAt: "2027-09-01T00:00:00.000Z",
    });

    await expect(attempt(current, "zsm3-demo", START)).resolves.toBe("redirect");
    await expect(failureRows(current)).resolves.toBe(0);
  });

  it("ignores counters left in the old fixed-window rate limit table", async ({ expect }) => {
    const current = store();
    await seed(current);
    await current.db
      .prepare("INSERT INTO rate_limits (key_hash, window_started_at, count) VALUES (?1, ?2, ?3)")
      .bind(await sha256(`shortlink-failures:${CODE}`), START.toISOString(), DAILY_FAILED_ATTEMPTS)
      .run();

    await expect(attempt(current, RIGHT, START)).resolves.toBe("redirect");
  });

  it("never asks the database about a code that cannot exist", async ({ expect }) => {
    const current = store();
    await seed(current);
    const real = shortLinksRepo(current);
    const asked: string[] = [];
    const links = {
      ...real,
      find: async (code: string) => {
        asked.push(code);
        return real.find(CODE);
      },
    };

    await expect(openLink({ links }, "zły kod!", START)).resolves.toEqual({ kind: "missing" });
    expect(asked).toEqual([]);
  });
});
