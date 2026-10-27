import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import type { Store } from "../../src/storage/database.ts";
import {
  AUTHOR_LINK_LIMIT,
  LAPSED_PRUNE_BATCH,
  shortLinksRepo,
  toRecord,
} from "../../src/storage/short-links-repo.ts";

const KEY = "short-link-pepper-0123456789-0123456789";
const TARGET = "https://example.org/materialy/lekcja.pdf";
const AUTHOR = "nauczyciel@zespolszkolmechanicznych.edu.pl";

function store(): Store {
  return { db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() };
}

describe("short link rows", () => {
  it("has batch sizes that keep a run bounded", ({ expect }) => {
    expect([LAPSED_PRUNE_BATCH, AUTHOR_LINK_LIMIT]).toEqual([500, 200]);
  });

  it("reads a row without a password as an open link", ({ expect }) => {
    expect(
      toRecord({
        code: "k7mq4ra",
        target_url: TARGET,
        password_salt: null,
        password_hash: null,
        expires_at: "2027-10-27T08:00:00.000Z",
        revoked_at: null,
      }),
    ).toEqual({
      code: "k7mq4ra",
      target: TARGET,
      expiresAt: "2027-10-27T08:00:00.000Z",
      revokedAt: null,
      password: null,
    });
  });

  it("keeps the salt and the digest together", ({ expect }) => {
    const record = toRecord({
      code: "k7mq4ra",
      target_url: TARGET,
      password_salt: new Uint8Array([1, 2]),
      password_hash: new Uint8Array([3, 4]),
      expires_at: "2027-10-27T08:00:00.000Z",
      revoked_at: null,
    });

    expect(record.password).toEqual({
      salt: new Uint8Array([1, 2]),
      hash: new Uint8Array([3, 4]),
    });
  });
});

describe("the short links table", () => {
  it("stores and reads a link with a password", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    const password = await hashPassword(KEY, "klasa4tp", counterRandom());
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password,
      createdBy: AUTHOR,
      expiresAt: "2027-10-27T08:00:00.000Z",
    });

    await expect(links.find("k7mq4ra")).resolves.toEqual({
      code: "k7mq4ra",
      target: TARGET,
      expiresAt: "2027-10-27T08:00:00.000Z",
      revokedAt: null,
      password,
    });
  });

  it("lists the links of one author, newest first", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    for (const code of ["k7mq4ra", "k7mq4rb"]) {
      await links.create({
        code,
        target: TARGET,
        password: null,
        createdBy: AUTHOR,
        expiresAt: "2027-10-27T08:00:00.000Z",
      });
    }
    await links.create({
      code: "k7mq4rc",
      target: TARGET,
      password: null,
      createdBy: "inny@zespolszkolmechanicznych.edu.pl",
      expiresAt: "2027-10-27T08:00:00.000Z",
    });

    const mine = await links.byAuthor(AUTHOR, AUTHOR_LINK_LIMIT);

    expect(mine.map((link) => link.code)).toEqual(["k7mq4ra", "k7mq4rb"]);
    expect(await links.byAuthor(AUTHOR, 1)).toHaveLength(1);
  });

  it("revokes a link once and leaves the first moment standing", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2027-10-27T08:00:00.000Z",
    });
    await links.revoke("k7mq4ra", "2026-10-27T08:00:00.000Z");
    await links.revoke("k7mq4ra", "2026-10-28T08:00:00.000Z");

    await expect(links.find("k7mq4ra")).resolves.toMatchObject({
      revokedAt: "2026-10-27T08:00:00.000Z",
    });
  });

  it("deletes links that lapsed before the cutoff and keeps the rest", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2026-10-23T00:00:00.000Z",
    });
    await links.create({
      code: "k7mq4rb",
      target: TARGET,
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2027-10-27T08:00:00.000Z",
    });
    await links.create({
      code: "k7mq4rc",
      target: TARGET,
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2027-10-27T08:00:00.000Z",
    });
    await links.revoke("k7mq4rc", "2026-10-25T00:00:00.000Z");

    await links.pruneLapsed("2027-01-01T00:00:00.000Z", LAPSED_PRUNE_BATCH);

    await expect(links.find("k7mq4ra")).resolves.toBeUndefined();
    await expect(links.find("k7mq4rc")).resolves.toBeUndefined();
    await expect(links.find("k7mq4rb")).resolves.toMatchObject({ code: "k7mq4rb" });
  });

  it("prunes no more than the batch allows", async ({ expect }) => {
    const current = store();
    const links = shortLinksRepo(current);
    for (const code of ["k7mq4ra", "k7mq4rb"]) {
      await links.create({
        code,
        target: TARGET,
        password: null,
        createdBy: AUTHOR,
        expiresAt: "2026-10-23T00:00:00.000Z",
      });
    }

    await links.pruneLapsed("2027-01-01T00:00:00.000Z", 1);

    const left = await links.byAuthor(AUTHOR, AUTHOR_LINK_LIMIT);

    expect(left).toHaveLength(1);
  });

  it("refuses a link that would expire before it is made", async ({ expect }) => {
    const current = store();

    await expect(
      shortLinksRepo(current).create({
        code: "k7mq4ra",
        target: TARGET,
        password: null,
        createdBy: AUTHOR,
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
  });
});
