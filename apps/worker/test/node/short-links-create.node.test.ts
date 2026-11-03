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
      body: { target: TARGET },
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
      body: { target: TARGET, password: "klasa4tp-2026" },
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
      unlockLink(deps(current, KEY), asked.code, "klasa4tp-2026", asked.now),
    ).resolves.toEqual({ kind: "redirect", target: TARGET });
  });

  it("refuses a body that is not a valid link", async ({ expect }) => {
    const current = store();

    await expect(
      createShortLink(creation(current, KEY), {
        body: { target: "http://example.org" },
        createdBy: "a@b.pl",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid" });
  });

  it("refuses a password when the server key is not configured", async ({ expect }) => {
    const current = store();

    await expect(
      createShortLink(creation(current, undefined), {
        body: { target: TARGET, password: "tajne-haslo-1" },
        createdBy: "a@b.pl",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("gives up when every generated code is taken", async ({ expect }) => {
    const current = store();
    const taken: ShortLinksRepo = {
      ...shortLinksRepo(current),
      inUse: async () => Promise.resolve(true),
    };

    await expect(
      createShortLink(
        { links: taken, random: current.random, passwordKey: KEY },
        { body: { target: TARGET }, createdBy: "a@b.pl", now: NOW },
      ),
    ).resolves.toEqual({ kind: "exhausted" });
  });

  it("expires a link at the start of the next school year in Warsaw", async ({ expect }) => {
    const current = store();
    const outcome = await createShortLink(creation(current, KEY), {
      body: { target: TARGET },
      createdBy: "a@b.pl",
      now: NOW,
    });

    expect(outcome.kind).toBe("created");
    if (outcome.kind !== "created") return;
    const lastMoment = new Date("2027-08-31T21:59:59.999Z");
    await expect(openLink(deps(current, KEY), outcome.code, lastMoment)).resolves.toEqual({
      kind: "redirect",
      target: TARGET,
    });
    const firstOfSeptember = new Date("2027-08-31T22:00:00.000Z");
    await expect(openLink(deps(current, KEY), outcome.code, firstOfSeptember)).resolves.toEqual({
      kind: "gone",
    });
    await expect(shortLinksRepo(current).created(outcome.code, "a@b.pl")).resolves.toMatchObject({
      expiresAt: "2027-08-31T22:00:00.000Z",
      target: TARGET,
      file: null,
    });
  });

  it("refuses the lifetime the old contract accepted", async ({ expect }) => {
    const current = store();

    await expect(
      createShortLink(creation(current, KEY), {
        body: { target: TARGET, lifetimeDays: 30 },
        createdBy: "a@b.pl",
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid" });
  });

  it("records who created the link in the audit log without the target or password", async ({
    expect,
  }) => {
    const current = store();
    const outcome = await createShortLink(creation(current, KEY), {
      body: { target: TARGET, password: "klasa4tp-2026" },
      createdBy: "a@b.pl",
      now: NOW,
    });
    if (outcome.kind !== "created") throw new Error("fixture");
    const rows = await current.db
      .prepare("SELECT actor_email, action, entity, entity_id, details_json FROM audit_log")
      .all();
    expect(rows.results).toEqual([
      {
        actor_email: "a@b.pl",
        action: "short_link.create",
        entity: "short_link",
        entity_id: outcome.code,
        details_json: JSON.stringify({ kind: "url", passwordProtected: true }),
      },
    ]);
  });
});
