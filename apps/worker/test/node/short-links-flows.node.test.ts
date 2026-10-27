import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import {
  openLink,
  passwordRedirect,
  PASSWORD_ATTEMPTS,
  submittedPassword,
  unlockLink,
} from "../../src/short-links/resolve.ts";
import type { Store } from "../../src/storage/database.ts";
import { rateLimitsRepo } from "../../src/storage/rate-limits-repo.ts";
import { shortLinksRepo, type ShortLinksRepo } from "../../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const NOW = new Date("2026-10-27T08:00:00.000Z");
const TARGET = "https://example.org/materialy/lekcja.pdf";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

function deps(current: Store, passwordKey: string | undefined) {
  return {
    links: shortLinksRepo(current),
    rateLimits: rateLimitsRepo(current),
    passwordKey,
  };
}

async function seed(
  links: ShortLinksRepo,
  code: string,
  overrides: { expiresAt?: string; password?: string } = {},
): Promise<void> {
  await links.create({
    code,
    target: TARGET,
    password:
      overrides.password === undefined
        ? null
        : await hashPassword(KEY, overrides.password, counterRandom()),
    createdBy: "nauczyciel@zespolszkolmechanicznych.edu.pl",
    expiresAt: overrides.expiresAt ?? "2027-10-27T08:00:00.000Z",
  });
}

describe("resolving a short link", () => {
  it("reports a code that cannot exist and one that does not", async ({ expect }) => {
    const current = store();

    await expect(openLink(deps(current, KEY), "NIE", NOW)).resolves.toEqual({ kind: "missing" });
    await expect(openLink(deps(current, KEY), "k7mq4ra", NOW)).resolves.toEqual({
      kind: "missing",
    });
  });

  it("accepts a code typed in capitals", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra");

    await expect(openLink(deps(current, KEY), " K7MQ4RA ", NOW)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
  });

  it("counts a click for every opened link", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra");
    await openLink(deps(current, KEY), "k7mq4ra", NOW);
    await openLink(deps(current, KEY), "k7mq4ra", NOW);

    await expect(
      current.db.prepare("SELECT clicks FROM short_links WHERE code = ?").bind("k7mq4ra").first(),
    ).resolves.toMatchObject({ clicks: 2 });
  });

  it("reports a revoked link as gone", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await seed(links, "k7mq4ra");
    await links.revoke("k7mq4ra", NOW.toISOString());

    await expect(openLink(deps(current, KEY), "k7mq4ra", NOW)).resolves.toEqual({ kind: "gone" });
  });

  it("asks for the password, then opens the link", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra", { password: "klasa4tp" });

    await expect(openLink(deps(current, KEY), "k7mq4ra", NOW)).resolves.toEqual({ kind: "locked" });
    await expect(unlockLink(deps(current, KEY), "k7mq4ra", "zle", NOW)).resolves.toEqual({
      kind: "locked",
    });
    await expect(unlockLink(deps(current, KEY), "k7mq4ra", "klasa4tp", NOW)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
  });

  it("does not count a click for a refused password", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra", { password: "klasa4tp" });
    await unlockLink(deps(current, KEY), "k7mq4ra", "zle", NOW);

    await expect(
      current.db.prepare("SELECT clicks FROM short_links WHERE code = ?").bind("k7mq4ra").first(),
    ).resolves.toMatchObject({ clicks: 0 });
  });

  it("cannot check a password without the server key", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra", { password: "klasa4tp" });

    await expect(unlockLink(deps(current, undefined), "k7mq4ra", "klasa4tp", NOW)).resolves.toEqual(
      { kind: "unavailable" },
    );
  });

  it("stops guessing after the attempt limit and lets the window pass", async ({ expect }) => {
    const current = store();
    await seed(shortLinksRepo(current), "k7mq4ra", { password: "klasa4tp" });
    for (let attempt = 0; attempt < PASSWORD_ATTEMPTS; attempt += 1) {
      await unlockLink(deps(current, KEY), "k7mq4ra", "zle", NOW);
    }

    await expect(unlockLink(deps(current, KEY), "k7mq4ra", "klasa4tp", NOW)).resolves.toEqual({
      kind: "throttled",
    });
    const later = new Date(NOW.getTime() + 11 * 60_000);
    await expect(unlockLink(deps(current, KEY), "k7mq4ra", "klasa4tp", later)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
  });

  it("limits guesses per link, not per visitor", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await seed(links, "k7mq4ra", { password: "klasa4tp" });
    await seed(links, "k7mq4rb", { password: "klasa4tp" });
    for (let attempt = 0; attempt < PASSWORD_ATTEMPTS; attempt += 1) {
      await unlockLink(deps(current, KEY), "k7mq4ra", "zle", NOW);
    }

    await expect(unlockLink(deps(current, KEY), "k7mq4rb", "klasa4tp", NOW)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
  });
});

describe("what the visitor is sent to next", () => {
  it("takes a filled password field and ignores everything else", ({ expect }) => {
    expect(submittedPassword("klasa4tp")).toBe("klasa4tp");
    expect(submittedPassword("")).toBeUndefined();
    expect(submittedPassword(undefined)).toBeUndefined();
    expect(submittedPassword(new File([], "plik.pdf"))).toBeUndefined();
  });

  it("goes to the material only when the password was right", ({ expect }) => {
    const path = "/s/k7mq4ra";

    expect(passwordRedirect({ kind: "redirect", target: TARGET }, path)).toBe(TARGET);
    expect(passwordRedirect({ kind: "locked" }, path)).toBe("/s/k7mq4ra?blad=haslo");
    expect(passwordRedirect({ kind: "throttled" }, path)).toBe("/s/k7mq4ra?blad=limit");
    expect(passwordRedirect({ kind: "unavailable" }, path)).toBe("/s/k7mq4ra?blad=brak");
    expect(passwordRedirect({ kind: "gone" }, path)).toBe(path);
    expect(passwordRedirect({ kind: "missing" }, path)).toBe(path);
  });
});
