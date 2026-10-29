import { panelShortLinksListSchema } from "@zsm3/contracts/panel";
import { CODE_ALPHABET } from "@zsm3/contracts/short-links";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { createApp } from "../src/app.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { AUTHOR_LINK_LIMIT, shortLinksRepo } from "../src/storage/short-links-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const OWNER = "owner@zsm3.test";
const OTHER = "other@zsm3.test";
const CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");
const store = { db: env.DB, clock: CLOCK, random: cryptoRandom };
const app = createApp({
  verifier: async (token) => {
    if (!token.includes("@")) {
      throw new Error("Invalid signature");
    }
    return await Promise.resolve({
      email: token,
      exp: 2_000_000_000,
      iat: 1_800_000_000,
      nbf: 1_850_000_000,
      aud: "acc.tag",
    });
  },
  origin: ORIGIN,
});

function request(token?: string, query = ""): Request {
  return new Request(`${ORIGIN}/api/panel/short-links${query}`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const staff = staffRepo(store);
  await staff.save(staffMember(OWNER, "editor", true));
  await staff.save(staffMember(OTHER, "secretariat", true));
  await staff.save(staffMember("admin@zsm3.test", "admin", true));
  await staff.save(staffMember("gallery@zsm3.test", "gallery_editor", true));
  await staff.save(staffMember("inactive@zsm3.test", "admin", false));
  const links = shortLinksRepo(store);
  await links.create({
    code: "k7mq4ra",
    target: "https://example.org/owner",
    password: { salt: new Uint8Array(16), hash: new Uint8Array(32) },
    createdBy: OWNER,
    expiresAt: "2027-10-22T08:00:00.000Z",
  });
  await links.create({
    code: "k7mq4rb",
    target: "https://example.org/other",
    password: null,
    createdBy: OTHER,
    expiresAt: "2027-10-22T08:00:00.000Z",
  });
});

describe("panel short links on D1", () => {
  it("applies the staff role matrix", async ({ expect }) => {
    for (const [token, status] of [
      [OWNER, 200],
      [OTHER, 200],
      ["admin@zsm3.test", 200],
      ["gallery@zsm3.test", 403],
    ] as const) {
      expect((await app.fetch(request(token), env)).status).toBe(status);
    }
  });

  it("returns only safe author metadata with no-store headers", async ({ expect }) => {
    const response = await app.fetch(request(OWNER), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const raw: unknown = await response.json();
    expect(panelShortLinksListSchema.parse(raw).items).toMatchObject([
      { code: "k7mq4ra", passwordProtected: true, clicks: 0 },
    ]);
    expect(panelShortLinksListSchema.parse(raw).nextCursor).toBeNull();
    expect(JSON.stringify(raw)).not.toMatch(/password_salt|password_hash|"salt"|"hash"|"key"/u);
    const other = await app.fetch(request(OTHER), env);
    const otherRaw: unknown = await other.json();
    expect(panelShortLinksListSchema.parse(otherRaw).items.map((item) => item.code)).toEqual([
      "k7mq4rb",
    ]);
  });

  it("stops at the exact limit without a phantom continuation", async ({ expect }) => {
    const response = await app.fetch(request(OWNER, "?limit=1"), env);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const raw: unknown = await response.json();
    const page = panelShortLinksListSchema.parse(raw);
    expect(page.items.map((item) => item.code)).toEqual(["k7mq4ra"]);
    expect(page.nextCursor).toBeNull();
    const params = new URLSearchParams({
      limit: "1",
      beforeCreatedAt: page.items[0]?.createdAt ?? "",
      beforeCode: "k7mq4ra",
    });
    const next = await app.fetch(request(OWNER, `?${params.toString()}`), env);
    const nextRaw: unknown = await next.json();
    expect(panelShortLinksListSchema.parse(nextRaw)).toEqual({ items: [], nextCursor: null });
  });

  it("rejects missing, forged, inactive and unknown identities", async ({ expect }) => {
    for (const [token, status] of [
      [undefined, 401],
      ["forged", 401],
      ["inactive@zsm3.test", 403],
      ["unknown@zsm3.test", 403],
    ] as const) {
      expect((await app.fetch(request(token), env)).status).toBe(status);
    }
  });

  it("bounds the D1 result to the author limit", async ({ expect }) => {
    const links = shortLinksRepo(store);
    for (let index = 0; index < AUTHOR_LINK_LIMIT; index += 1) {
      const code = `k${CODE_ALPHABET.charAt(Math.floor(index / CODE_ALPHABET.length))}${CODE_ALPHABET.charAt(index % CODE_ALPHABET.length)}aaaa`;
      await links.create({
        code,
        target: "https://example.org/owner",
        password: null,
        createdBy: OWNER,
        expiresAt: "2027-10-22T08:00:00.000Z",
      });
    }
    const response = await app.fetch(request(OWNER, "?limit=200"), env);
    const raw: unknown = await response.json();
    expect(response.status).toBe(200);
    const first = panelShortLinksListSchema.parse(raw);
    expect(first.items).toHaveLength(AUTHOR_LINK_LIMIT);
    expect(first.nextCursor).toEqual({
      createdAt: CLOCK().toISOString(),
      code: first.items[199]?.code,
    });
    if (first.nextCursor === null) {
      throw new Error("fixture");
    }
    const params = new URLSearchParams({
      beforeCreatedAt: first.nextCursor.createdAt,
      beforeCode: first.nextCursor.code,
      limit: "200",
    });
    const secondResponse = await app.fetch(request(OWNER, `?${params.toString()}`), env);
    expect(secondResponse.headers.get("cache-control")).toBe("no-store");
    const secondRaw: unknown = await secondResponse.json();
    const second = panelShortLinksListSchema.parse(secondRaw);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.code)).size).toBe(201);
    const otherResponse = await app.fetch(request(OTHER, `?${params.toString()}`), env);
    const otherRaw: unknown = await otherResponse.json();
    expect(panelShortLinksListSchema.parse(otherRaw)).toEqual({ items: [], nextCursor: null });
  });

  it("rejects invalid pagination parameters", async ({ expect }) => {
    for (const query of [
      "?limit=0",
      "?limit=201",
      "?limit=bad",
      "?limit=0x10",
      "?limit=1e2",
      "?limit=1&limit=201",
      "?limit=1&limit=1",
      "?beforeCode=k7mq4ra",
      "?beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCode=k7mq4ra",
      "?beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCode=k7mq4ra&beforeCode=k7mq4ra",
      "?beforeCreatedAt=bad&beforeCode=k7mq4ra",
      "?other=1",
      "?other=1&other=2",
    ]) {
      const response = await app.fetch(request(OWNER, query), env);
      expect(response.status).toBe(422);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});
