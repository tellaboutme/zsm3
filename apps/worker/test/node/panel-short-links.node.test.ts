import { panelShortLinksListSchema } from "@zsm3/contracts/panel";
import { CODE_ALPHABET } from "@zsm3/contracts/short-links";
import { describe, it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  panelRawCall,
  seedStaff,
  staffClaims,
} from "./panel-support.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { AUTHOR_LINK_LIMIT, shortLinksRepo } from "../../src/storage/short-links-repo.ts";

const OWNER = "editor@zsm3.test";
const OTHER = "other@zsm3.test";
const TARGET = "https://example.org/materialy";

function codeFor(index: number): string {
  const base = CODE_ALPHABET.length;
  return `k${CODE_ALPHABET.charAt(Math.floor(index / base))}${CODE_ALPHABET.charAt(index % base)}aaaa`;
}

describe("panel short links list", () => {
  it("scopes metadata to the authenticated author and excludes password material", async ({
    expect,
  }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [staffMember(OWNER, "editor", true)]);
    const links = shortLinksRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom });
    const expiresAt = "2027-10-22T08:00:00.000Z";
    await links.create({
      code: "k7mq4ra",
      target: TARGET,
      password: { salt: new Uint8Array(16), hash: new Uint8Array(32) },
      createdBy: OWNER,
      expiresAt,
    });
    await links.create({
      code: "k7mq4rb",
      target: TARGET,
      password: null,
      createdBy: OTHER,
      expiresAt,
    });
    const token = await harness.keys.sign(staffClaims(OWNER));
    const response = await panelJsonCall(harness, "GET", "/short-links", { token });
    const raw: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const items = panelShortLinksListSchema.parse(raw).items;
    expect(items).toHaveLength(1);
    expect(panelShortLinksListSchema.parse(raw).nextCursor).toBeNull();
    expect(items[0]).toMatchObject({ code: "k7mq4ra", target: TARGET, passwordProtected: true });
    expect(JSON.stringify(raw)).not.toMatch(/password_salt|password_hash|"salt"|"hash"|"key"/u);
  });

  it("rejects missing, forged, inactive and unlisted identities", async () => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [staffMember(OWNER, "editor", false)]);
    const inactive = await harness.keys.sign(staffClaims(OWNER));
    const absent = await harness.keys.sign(staffClaims(OTHER));
    await expectProblem(await panelRawCall(harness, "GET", "/short-links", { headers: {} }), 401);
    await expectProblem(
      await panelJsonCall(harness, "GET", "/short-links", { token: "forged" }),
      401,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", "/short-links", { token: inactive }),
      403,
    );
    await expectProblem(
      await panelJsonCall(harness, "GET", "/short-links", { token: absent }),
      403,
    );
  });

  it("paginates beyond 200 links with equal timestamps without gaps or duplicates", async ({
    expect,
  }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [staffMember(OWNER, "editor", true)]);
    const links = shortLinksRepo({
      db: harness.env.DB,
      clock: () => new Date("2026-10-22T08:00:00Z"),
      random: cryptoRandom,
    });
    for (let index = 0; index <= AUTHOR_LINK_LIMIT; index += 1) {
      await links.create({
        code: codeFor(index),
        target: TARGET,
        password: null,
        createdBy: OWNER,
        expiresAt: "2027-10-22T08:00:00.000Z",
      });
    }
    const token = await harness.keys.sign(staffClaims(OWNER));
    const response = await panelJsonCall(harness, "GET", "/short-links?limit=200", { token });
    const raw: unknown = await response.json();
    expect(response.status).toBe(200);
    const first = panelShortLinksListSchema.parse(raw);
    expect(first.items).toHaveLength(AUTHOR_LINK_LIMIT);
    expect(first.nextCursor).toEqual({
      createdAt: "2026-10-22T08:00:00.000Z",
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
    const nextResponse = await panelJsonCall(harness, "GET", `/short-links?${params.toString()}`, {
      token,
    });
    const nextRaw: unknown = await nextResponse.json();
    const next = panelShortLinksListSchema.parse(nextRaw);
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
    expect(new Set([...first.items, ...next.items].map((item) => item.code)).size).toBe(201);
  });

  it("rejects malformed query fields before reading links", async ({ expect }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [staffMember(OWNER, "editor", true)]);
    const token = await harness.keys.sign(staffClaims(OWNER));
    for (const query of [
      "limit=0",
      "limit=201",
      "limit=abc",
      "limit=1.5",
      "limit=0x10",
      "limit=1e2",
      "limit=1&limit=201",
      "limit=1&limit=1",
      "beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z",
      "beforeCode=k7mq4ra",
      "beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCode=k7mq4ra",
      "beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCode=k7mq4ra&beforeCode=k7mq4ra",
      "beforeCreatedAt=bad&beforeCode=k7mq4ra",
      "beforeCreatedAt=2026-10-22T08%3A00%3A00Z&beforeCode=k7mq4ra",
      "beforeCreatedAt=2026-10-22T08%3A00%3A00.000Z&beforeCode=bad",
      "unknown=1",
      "unknown=1&unknown=2",
    ]) {
      const response = await panelJsonCall(harness, "GET", `/short-links?${query}`, { token });
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expectProblem(response, 422);
    }
  });

  it("continues from equal timestamps into older links", async ({ expect }) => {
    const harness = await panelHarness();
    await seedStaff(harness.env, [staffMember(OWNER, "editor", true)]);
    for (const [code, createdAt] of [
      ["k7mq4ra", "2026-10-22T08:00:00Z"],
      ["k7mq4rb", "2026-10-22T08:00:00Z"],
      ["k7mq4rc", "2026-10-21T08:00:00Z"],
    ] as const) {
      await shortLinksRepo({
        db: harness.env.DB,
        clock: () => new Date(createdAt),
        random: cryptoRandom,
      }).create({
        code,
        target: TARGET,
        password: null,
        createdBy: OWNER,
        expiresAt: "2027-10-22T08:00:00.000Z",
      });
    }
    const token = await harness.keys.sign(staffClaims(OWNER));
    let cursor: { createdAt: string; code: string } | null = null;
    const codes: string[] = [];
    do {
      const params = new URLSearchParams({ limit: "1" });
      if (cursor !== null) {
        params.set("beforeCreatedAt", cursor.createdAt);
        params.set("beforeCode", cursor.code);
      }
      const response = await panelJsonCall(harness, "GET", `/short-links?${params.toString()}`, {
        token,
      });
      const raw: unknown = await response.json();
      const page = panelShortLinksListSchema.parse(raw);
      codes.push(...page.items.map((item) => item.code));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(codes).toEqual(["k7mq4ra", "k7mq4rb", "k7mq4rc"]);
  });
});
