import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { seedShortLinks } from "../../seed/short-links.ts";
import { openLink, unlockLink } from "../../src/short-links/resolve.ts";
import type { Store } from "../../src/storage/database.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const NOW = new Date("2026-10-27T08:00:00.000Z");
const OPEN_TARGET = "https://example.org/materialy/plan-lekcji.pdf";
const PROTECTED_TARGET = "https://example.org/materialy/karta-pracy.pdf";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("short link demo seeds", () => {
  it("omits the protected link without a key while keeping open demos", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);

    await expect(seedShortLinks(current, undefined)).resolves.toBe(2);
    await expect(links.find("zhasqem")).resolves.toBeUndefined();
    await expect(openLink({ links }, "zhasqem", NOW)).resolves.toEqual({ kind: "missing" });
    await expect(
      unlockLink(
        { links, rateLimits: rateLimitsRepo(current), passwordKey: undefined },
        "zhasqem",
        "zsm3-demo",
        NOW,
      ),
    ).resolves.toEqual({ kind: "missing" });
    await expect(openLink({ links }, "materia", NOW)).resolves.toEqual({
      kind: "redirect",
      target: OPEN_TARGET,
    });
    await expect(openLink({ links }, "wygasny", NOW)).resolves.toEqual({ kind: "gone" });
    await expect(seedShortLinks(current, undefined)).resolves.toBe(0);
  });

  it("adds a working protected link when the key appears and remains idempotent", async ({
    expect,
  }) => {
    const current = store();
    const links = shortLinksRepo(current);
    const deps = { links, rateLimits: rateLimitsRepo(current), passwordKey: KEY };

    await expect(seedShortLinks(current, undefined)).resolves.toBe(2);
    const openBefore = await links.find("materia");
    const revokedBefore = await links.find("wygasny");
    await expect(seedShortLinks(current, KEY)).resolves.toBe(1);
    await expect(openLink({ links }, "zhasqem", NOW)).resolves.toEqual({ kind: "locked" });
    await expect(
      unlockLink({ ...deps, passwordKey: undefined }, "zhasqem", "zsm3-demo", NOW),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(unlockLink(deps, "zhasqem", "wrong", NOW)).resolves.toEqual({ kind: "locked" });
    await expect(unlockLink(deps, "zhasqem", "zsm3-demo", NOW)).resolves.toEqual({
      kind: "redirect",
      target: PROTECTED_TARGET,
    });
    const protectedBefore = await links.find("zhasqem");

    await expect(seedShortLinks(current, KEY)).resolves.toBe(0);
    await expect(links.find("materia")).resolves.toEqual(openBefore);
    await expect(links.find("wygasny")).resolves.toEqual(revokedBefore);
    await expect(links.find("zhasqem")).resolves.toEqual(protectedBefore);
    await expect(unlockLink(deps, "zhasqem", "zsm3-demo", NOW)).resolves.toEqual({
      kind: "redirect",
      target: PROTECTED_TARGET,
    });
  });

  it("does not overwrite a protected row when seeded with another key", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    const otherKey = "another-short-link-pepper-0123456789";

    await expect(seedShortLinks(current, KEY)).resolves.toBe(3);
    const original = await links.find("zhasqem");
    await expect(seedShortLinks(current, otherKey)).resolves.toBe(0);
    await expect(links.find("zhasqem")).resolves.toEqual(original);
    await expect(
      unlockLink(
        { links, rateLimits: rateLimitsRepo(current), passwordKey: otherKey },
        "zhasqem",
        "zsm3-demo",
        NOW,
      ),
    ).resolves.toEqual({ kind: "locked" });
    await expect(
      unlockLink(
        { links, rateLimits: rateLimitsRepo(current), passwordKey: KEY },
        "zhasqem",
        "zsm3-demo",
        NOW,
      ),
    ).resolves.toEqual({ kind: "redirect", target: PROTECTED_TARGET });
  });
});
