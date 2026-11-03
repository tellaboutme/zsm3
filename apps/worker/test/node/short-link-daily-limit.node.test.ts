import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { sha256 } from "../../src/security/hmac.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import {
  DAILY_FAILED_ATTEMPTS,
  openLink,
  passwordRedirect,
  unlockLink,
} from "../../src/short-links/resolve.ts";
import type { Store } from "../../src/storage/database.ts";
import { RATE_LIMIT_RETENTION_MS, rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const START = new Date("2026-10-27T08:00:00.000Z");
const CODE = "k7mq4ra";
const OPEN = "m3pq7xt";
const RIGHT = "zielony-rower-po-deszczu";
const MINUTE = 60_000;

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

function deps(current: Store) {
  return { links: shortLinksRepo(current), rateLimits: rateLimitsRepo(current), passwordKey: KEY };
}

async function seed(current: Store): Promise<void> {
  const links = shortLinksRepo(current);
  for (const [code, password] of [
    [CODE, await hashPassword(KEY, RIGHT, counterRandom())],
    [OPEN, null],
  ] as const) {
    await links.create({
      code,
      target: "https://example.org/materialy",
      password,
      createdBy: "nauczyciel@zsm3.test",
      expiresAt: "2027-09-01T00:00:00.000Z",
    });
  }
}

async function failSpread(current: Store, count: number, from: Date): Promise<Date> {
  let at = from;
  for (let index = 0; index < count; index += 1) {
    if (index > 0 && index % 20 === 0) {
      at = new Date(at.getTime() + 11 * MINUTE);
    }
    const outcome = await unlockLink(deps(current), CODE, "zle-haslo-123", at);
    if (outcome.kind !== "locked") {
      throw new Error(`attempt ${String(index)} was ${outcome.kind}`);
    }
  }
  return at;
}

async function clicks(current: Store): Promise<unknown> {
  return current.db.prepare("SELECT clicks FROM short_links WHERE code = ?1").bind(CODE).first();
}

describe("the daily limit on wrong passwords", () => {
  it("blocks even the right password once a day's failures are used up", async ({ expect }) => {
    const current = store();
    await seed(current);

    const last = await failSpread(current, DAILY_FAILED_ATTEMPTS, START);
    const outcome = await unlockLink(deps(current), CODE, RIGHT, new Date(last.getTime() + MINUTE));

    expect(DAILY_FAILED_ATTEMPTS).toBe(100);
    expect(outcome).toEqual({ kind: "blocked" });
    expect(await clicks(current)).toEqual({ clicks: 0 });
    expect(passwordRedirect({ kind: "blocked" }, "/s/k7mq4ra")).toBe("/s/k7mq4ra?blad=doba");
  });

  it("opens again when the day that began with the first failure is over", async ({ expect }) => {
    const current = store();
    await seed(current);
    await failSpread(current, DAILY_FAILED_ATTEMPTS, START);
    const nextDay = new Date(START.getTime() + 24 * 60 * MINUTE + MINUTE);

    await expect(unlockLink(deps(current), CODE, RIGHT, nextDay)).resolves.toMatchObject({
      kind: "redirect",
    });
  });

  it("counts only wrong passwords, not successes or empty submissions", async ({ expect }) => {
    const current = store();
    await seed(current);
    const last = await failSpread(current, DAILY_FAILED_ATTEMPTS - 1, START);
    const later = new Date(last.getTime() + 11 * MINUTE);

    for (let index = 0; index < 5; index += 1) {
      await expect(unlockLink(deps(current), CODE, RIGHT, later)).resolves.toMatchObject({
        kind: "redirect",
      });
      await expect(unlockLink(deps(current), CODE, undefined, later)).resolves.toEqual({
        kind: "locked",
      });
    }
    await expect(unlockLink(deps(current), CODE, RIGHT, later)).resolves.toMatchObject({
      kind: "redirect",
    });
    await expect(unlockLink(deps(current), CODE, "zle-haslo-123", later)).resolves.toEqual({
      kind: "locked",
    });
    await expect(unlockLink(deps(current), CODE, RIGHT, later)).resolves.toEqual({
      kind: "blocked",
    });
  });

  it("never touches the budget for an open link", async ({ expect }) => {
    const current = store();
    await seed(current);

    for (let index = 0; index < DAILY_FAILED_ATTEMPTS + 5; index += 1) {
      await expect(unlockLink(deps(current), OPEN, "cokolwiek", START)).resolves.toMatchObject({
        kind: "redirect",
      });
    }
    const rows = await current.db.prepare("SELECT COUNT(*) AS n FROM rate_limits").first();
    expect(rows).toEqual({ n: 0 });
  });

  it("keys the budget by a hash of the link alone, never a visitor", async ({ expect }) => {
    const current = store();
    await seed(current);
    await failSpread(current, 1, START);

    const rows = await current.db
      .prepare("SELECT lower(hex(key_hash)) AS key, count FROM rate_limits ORDER BY key")
      .all();
    const failures = Buffer.from(await sha256(`shortlink-failures:${CODE}`)).toString("hex");
    const guesses = Buffer.from(await sha256(`shortlink:${CODE}`)).toString("hex");

    expect(rows.results).toEqual(
      [
        { key: failures, count: 1 },
        { key: guesses, count: 1 },
      ].toSorted((left, right) => left.key.localeCompare(right.key)),
    );
  });
});

describe("guards around the password budget", () => {
  it("keeps rate limit rows for the whole daily window", ({ expect }) => {
    expect(RATE_LIMIT_RETENTION_MS).toBe(24 * 60 * MINUTE);
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
