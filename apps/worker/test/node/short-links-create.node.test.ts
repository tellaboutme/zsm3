import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { createShortLink, type CreateDeps } from "../../src/short-links/create.ts";
import { openLink, unlockLink } from "../../src/short-links/resolve.ts";
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

function creation(current: Store, passwordKey: string | undefined): CreateDeps {
  return { links: shortLinksRepo(current), random: current.random, passwordKey };
}

describe("creating a short link", () => {
  it("stores the target and returns a code that resolves", async ({ expect }) => {
    const current = store();
    const outcome = await createShortLink(creation(current, KEY), {
      body: { target: TARGET, lifetimeDays: 30 },
      createdBy: "nauczyciel@zespolszkolmechanicznych.edu.pl",
      now: NOW,
    });

    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") return;
    await expect(openLink(deps(current, KEY), outcome.code, NOW)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
  });

  it("locks a link behind the password the teacher chose", async ({ expect }) => {
    const current = store();
    const outcome = await createShortLink(creation(current, KEY), {
      body: { target: TARGET, lifetimeDays: 30, password: "klasa4tp" },
      createdBy: "nauczyciel@zespolszkolmechanicznych.edu.pl",
      now: NOW,
    });

    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") return;
    const asked = { code: outcome.code, now: NOW };
    await expect(openLink(deps(current, KEY), asked.code, asked.now)).resolves.toEqual({
      kind: "locked",
    });
    await expect(unlockLink(deps(current, KEY), asked.code, "zle", asked.now)).resolves.toEqual({
      kind: "locked",
    });
    await expect(
      unlockLink(deps(current, KEY), asked.code, "klasa4tp", asked.now),
    ).resolves.toEqual({ kind: "redirect", target: TARGET });
  });

  it("refuses a body that is not a valid link", async ({ expect }) => {
    const current = store();

    await expect(
      createShortLink(creation(current, KEY), {
        body: { target: "http://example.org", lifetimeDays: 30 },
        createdBy: "a@b.pl",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid" });
  });

  it("refuses a password when the server key is not configured", async ({ expect }) => {
    const current = store();

    await expect(
      createShortLink(creation(current, undefined), {
        body: { target: TARGET, lifetimeDays: 30, password: "tajne1" },
        createdBy: "a@b.pl",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("gives up when every generated code is taken", async ({ expect }) => {
    const current = store();
    const taken: ShortLinksRepo = {
      ...shortLinksRepo(current),
      find: async () =>
        Promise.resolve({
          code: "k7mq4ra",
          target: TARGET,
          expiresAt: "2027-10-27T08:00:00.000Z",
          revokedAt: null,
          password: null,
        }),
    };

    await expect(
      createShortLink(
        { links: taken, random: current.random, passwordKey: KEY },
        { body: { target: TARGET, lifetimeDays: 30 }, createdBy: "a@b.pl", now: NOW },
      ),
    ).resolves.toEqual({ kind: "exhausted" });
  });

  it("expires a link after the chosen number of days", async ({ expect }) => {
    const current = store();
    const outcome = await createShortLink(creation(current, KEY), {
      body: { target: TARGET, lifetimeDays: 1 },
      createdBy: "a@b.pl",
      now: NOW,
    });

    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") return;
    const later = new Date("2026-10-28T08:00:01.000Z");
    await expect(openLink(deps(current, KEY), outcome.code, later)).resolves.toEqual({
      kind: "gone",
    });
  });
});
