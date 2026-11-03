import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";
import { z } from "zod";

import { hashPassword } from "../src/security/passwords.ts";
import { PASSWORD_ATTEMPTS, unlockLink } from "../src/short-links/resolve.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { rateLimitsRepo } from "../src/storage/rate-limits-repo.ts";
import {
  DAILY_FAILED_ATTEMPTS,
  shortLinkFailuresRepo,
} from "../src/storage/short-link-failures-repo.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const RIGHT = "zielony-rower-po-deszczu";
const NOW = new Date("2026-10-27T08:00:00.000Z");
const store = { db: env.DB, clock: () => NOW, random: cryptoRandom };
const deps = {
  links: shortLinksRepo(store),
  rateLimits: rateLimitsRepo(store),
  failures: shortLinkFailuresRepo(store),
  passwordKey: KEY,
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

async function protectedLink(code: string): Promise<void> {
  await deps.links.create({
    code,
    target: "https://example.org/materialy",
    password: await hashPassword(KEY, RIGHT, cryptoRandom),
    createdBy: "nauczyciel@zsm3.test",
    expiresAt: "2027-09-01T00:00:00.000Z",
  });
}

async function rows(code: string): Promise<number> {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM short_link_failures WHERE code = ?1")
    .bind(code)
    .first();
  return z.strictObject({ n: z.number() }).parse(row).n;
}

describe("the daily failure budget on real D1", () => {
  it("grants no more than one hundred slots to concurrent reservations", async ({ expect }) => {
    const slots = await Promise.all(
      Array.from({ length: DAILY_FAILED_ATTEMPTS + 50 }, async () =>
        deps.failures.reserve("k7mq4rc", NOW),
      ),
    );

    expect(slots.filter((slot) => slot !== undefined)).toHaveLength(DAILY_FAILED_ATTEMPTS);
    await expect(rows("k7mq4rc")).resolves.toBe(DAILY_FAILED_ATTEMPTS);
  });

  it("lets concurrent wrong passwords fill the budget exactly to one hundred", async ({
    expect,
  }) => {
    await protectedLink("k7mq4rd");
    const spent = DAILY_FAILED_ATTEMPTS - 10;
    for (let index = 0; index < spent; index += 1) {
      await deps.failures.reserve("k7mq4rd", new Date(NOW.getTime() - 60_000));
    }

    const outcomes = await Promise.all(
      Array.from({ length: PASSWORD_ATTEMPTS }, async () =>
        unlockLink(deps, "k7mq4rd", "zle-haslo-123", NOW),
      ),
    );
    const kinds = outcomes.map((outcome) => outcome.kind);

    expect(kinds.filter((kind) => kind === "locked")).toHaveLength(10);
    expect(kinds.filter((kind) => kind === "blocked")).toHaveLength(PASSWORD_ATTEMPTS - 10);
    await expect(rows("k7mq4rd")).resolves.toBe(DAILY_FAILED_ATTEMPTS);
  });

  it("returns the slot of every concurrent right password", async ({ expect }) => {
    await protectedLink("k7mq4rf");

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, async () => unlockLink(deps, "k7mq4rf", RIGHT, NOW)),
    );

    expect(new Set(outcomes.map((outcome) => outcome.kind))).toEqual(new Set(["redirect"]));
    await expect(rows("k7mq4rf")).resolves.toBe(0);
  });
});
