import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { hashPassword } from "../../src/security/passwords.ts";
import type { Store } from "../../src/storage/database.ts";
import {
  AUTHOR_LINK_LIMIT,
  LAPSED_PRUNE_BATCH,
  shortLinksRepo,
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
    const password = await hashPassword(KEY, "klasa4tp", counterRandom());
    for (const code of ["k7mq4ra", "k7mq4rb"]) {
      await links.create({
        code,
        target: TARGET,
        password: code === "k7mq4ra" ? password : null,
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

    expect(mine).toEqual([
      {
        code: "k7mq4ra",
        target: TARGET,
        createdAt: FIXED_CLOCK().toISOString(),
        expiresAt: "2027-10-27T08:00:00.000Z",
        revokedAt: null,
        clicks: 0,
        passwordProtected: true,
      },
      {
        code: "k7mq4rb",
        target: TARGET,
        createdAt: FIXED_CLOCK().toISOString(),
        expiresAt: "2027-10-27T08:00:00.000Z",
        revokedAt: null,
        clicks: 0,
        passwordProtected: false,
      },
    ]);
    expect(mine[0]).not.toHaveProperty("password");
    expect(mine[0]).not.toHaveProperty("password_salt");
    expect(mine[0]).not.toHaveProperty("password_hash");
    expect(await links.byAuthor(AUTHOR, 1)).toHaveLength(1);
    expect(await links.byAuthor(AUTHOR, 0)).toEqual([]);
    expect(await links.byAuthor(AUTHOR, 500)).toHaveLength(2);
    await expect(links.byAuthor(AUTHOR, -1)).rejects.toThrow();
    await links.countClick("k7mq4ra");
    await expect(links.byAuthor(AUTHOR, 1)).resolves.toMatchObject([{ clicks: 1 }]);
  });

  it("only lets the author revoke once and leaves the first moment standing", async ({
    expect,
  }) => {
    const current = store();
    const links = shortLinksRepo(current);
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password: null,
      createdBy: AUTHOR,
      expiresAt: "2027-10-27T08:00:00.000Z",
    });
    await expect(
      links.revoke("k7mq4ra", "other@example.org", "2026-10-26T08:00:00.000Z"),
    ).resolves.toBe(false);
    await expect(links.revoke("missing", AUTHOR, "2026-10-26T08:00:00.000Z")).resolves.toBe(false);
    await expect(links.revoke("k7mq4ra", AUTHOR, "2026-10-27T08:00:00.000Z")).resolves.toBe(true);
    await expect(links.revoke("k7mq4ra", AUTHOR, "2026-10-28T08:00:00.000Z")).resolves.toBe(false);

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
    await links.revoke("k7mq4rc", AUTHOR, "2026-10-25T00:00:00.000Z");

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
