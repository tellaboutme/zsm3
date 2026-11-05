import { z } from "zod";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import { unlockLink, type ResolveDeps, type UnlockOutcome } from "../../src/short-links/resolve.ts";
import type { Store } from "../../src/storage/database.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinkFailuresRepo } from "../../src/storage/short-link-failures-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

export const KEY = "short-link-pepper-0123456789-0123456789";
export const START = new Date("2026-10-27T08:00:00.000Z");
export const CODE = "k7mq4ra";
export const OTHER = "k7mq4rb";
export const OPEN = "m3pq7xt";
export const RIGHT = "zielony-rower-po-deszczu";
export const WRONG = "zle-haslo-123";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

export function deps(current: Store): ResolveDeps {
  return {
    links: shortLinksRepo(current),
    rateLimits: rateLimitsRepo(current),
    failures: shortLinkFailuresRepo(current),
    passwordKey: KEY,
  };
}

export async function seed(current: Store): Promise<void> {
  const links = shortLinksRepo(current);
  for (const [code, password] of [
    [CODE, await hashPassword(KEY, RIGHT, counterRandom())],
    [OTHER, await hashPassword(KEY, RIGHT, counterRandom())],
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

export function at(base: Date, offset: number): Date {
  return new Date(base.getTime() + offset);
}

export async function attempt(
  current: Store,
  password: string,
  when: Date,
  code = CODE,
): Promise<UnlockOutcome["kind"]> {
  return (await unlockLink(deps(current), code, password, when)).kind;
}

export async function failSpread(
  current: Store,
  count: number,
  from: Date,
  code = CODE,
): Promise<Date> {
  let when = from;
  for (let index = 0; index < count; index += 1) {
    if (index > 0 && index % 20 === 0) {
      when = at(when, 11 * MINUTE);
    }
    const outcome = await attempt(current, WRONG, when, code);
    if (outcome !== "locked") {
      throw new Error(`attempt ${String(index)} was ${outcome}`);
    }
  }
  return when;
}

export async function failureRows(current: Store, code = CODE): Promise<number> {
  const row = await current.db
    .prepare("SELECT count(*) AS n FROM short_link_failures WHERE code = ?1")
    .bind(code)
    .first();
  return z.strictObject({ n: z.number() }).parse(row).n;
}

export async function seedFailures(current: Store, count: number, when: Date): Promise<void> {
  const failures = shortLinkFailuresRepo(current);
  for (let index = 0; index < count; index += 1) {
    await failures.reserve(CODE, when);
  }
}
