import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, it } from "vitest";

import { createApp } from "../src/app.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const OWNER = "owner@zsm3.test";
const OTHER = "other@zsm3.test";
const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };
const app = createApp({
  verifier: async (token) => {
    if (!token.includes("@")) throw new Error("Invalid signature");
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

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const staff = staffRepo(store);
  await staff.save(staffMember(OWNER, "editor", true));
  await staff.save(staffMember(OTHER, "secretariat", true));
  await staff.save(staffMember("gallery@zsm3.test", "gallery_editor", true));
  await shortLinksRepo(store).create({
    code: "k7mq4rb",
    target: "https://example.org",
    password: null,
    createdBy: OTHER,
    expiresAt: "2027-10-22T08:00:00.000Z",
  });
  await shortLinksRepo(store).create({
    code: "k7mq4rc",
    target: "https://example.org",
    password: null,
    createdBy: OTHER,
    expiresAt: "2027-10-22T08:00:00.000Z",
  });
});

it("revokes only an owned active link through authenticated JSON requests", async ({ expect }) => {
  const code = "k7mq4rb";
  const url = `${ORIGIN}/api/panel/short-links/${code}`;
  const call = async (token: string, origin = ORIGIN, contentType = "application/json") =>
    app.fetch(
      new Request(url, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
          origin,
          "content-type": contentType,
        },
      }),
      env,
    );
  expect((await call("gallery@zsm3.test")).status).toBe(403);
  expect((await call(OWNER)).status).toBe(404);
  expect((await call(OTHER, "https://evil.example")).status).toBe(403);
  expect((await call(OTHER, ORIGIN, "text/plain")).status).toBe(403);
  const result = await call(OTHER);
  expect(result.status).toBe(204);
  expect(await result.text()).toBe("");
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect((await call(OTHER)).status).toBe(404);
  const audits = await env.DB.prepare("SELECT * FROM audit_log WHERE entity_id = ?1")
    .bind(code)
    .all();
  expect(audits.results).toHaveLength(1);
  const audit = audits.results[0];
  expect(audit).toMatchObject({
    actor_email: OTHER,
    details_json: JSON.stringify({ revoked_at: audit?.["at"] }),
  });
  expect(audit?.["id"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
  expect((await shortLinksRepo(store).find(code))?.revokedAt).toBe(audit?.["at"]);
  expect(JSON.stringify(audit)).not.toMatch(/password|salt|hash/u);
});

it("records one audit for two concurrent DELETE requests", async ({ expect }) => {
  const request = () =>
    new Request(`${ORIGIN}/api/panel/short-links/k7mq4rc`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${OTHER}`,
        origin: ORIGIN,
        "content-type": "application/json",
      },
    });
  const responses = await Promise.all([app.fetch(request(), env), app.fetch(request(), env)]);
  expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([204, 404]);
  const audits = await env.DB.prepare("SELECT id FROM audit_log WHERE entity_id = ?1")
    .bind("k7mq4rc")
    .all();
  expect(audits.results).toHaveLength(1);
});
