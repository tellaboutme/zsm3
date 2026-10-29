import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { cryptoRandom } from "../src/storage/ids.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

const AUTHOR = "owner@example.org";
const TARGET = "https://example.org/materialy/lekcja.pdf";
const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("short links on D1", () => {
  it("returns safe owner metadata and changes only the owner's active link", async ({ expect }) => {
    const links = shortLinksRepo(store);
    const password = { salt: new Uint8Array(16), hash: new Uint8Array(32) };
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password,
      createdBy: AUTHOR,
      expiresAt: "2027-10-22T08:00:00.000Z",
    });

    await expect(links.byAuthor(AUTHOR, 1)).resolves.toEqual([
      {
        code: "k7mq4ra",
        target: TARGET,
        createdAt: "2026-10-22T08:00:00.000Z",
        expiresAt: "2027-10-22T08:00:00.000Z",
        revokedAt: null,
        clicks: 0,
        passwordProtected: true,
      },
    ]);
    await expect(
      links.revoke("k7mq4ra", "other@example.org", "2026-10-23T08:00:00.000Z"),
    ).resolves.toBe(false);
    await expect(links.revoke("k7mq4ra", AUTHOR, "2026-10-24T08:00:00.000Z")).resolves.toBe(true);
    await expect(links.revoke("k7mq4ra", AUTHOR, "2026-10-25T08:00:00.000Z")).resolves.toBe(false);
    await expect(links.find("k7mq4ra")).resolves.toMatchObject({
      revokedAt: "2026-10-24T08:00:00.000Z",
      password,
    });
  });
});
