import { panelMeSchema, panelNewsListSchema } from "@zsm3/contracts/panel";
import { problemDetailsSchema } from "@zsm3/contracts/problem";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { Hono } from "hono";
import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, it } from "vitest";

import type { AppEnv } from "../src/app-env.ts";
import { createApp } from "../src/app.ts";
import {
  newsSaveMutation,
  newsStatusMutation,
  sampleNews,
  staffMember,
} from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { createAccessVerifier, type AccessVerifier } from "../src/security/access-jwt.ts";
import { auditRepo } from "../src/storage/audit-repo.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { revisionsRepo } from "../src/storage/revisions-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const ISSUER = "https://cloudflareaccess.example";
const AUDIENCE = "acc.tag";
const TEST_CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");
const VERIFIER_CLOCK = (): Date => new Date(1_850_000_000_000);
const KEY_ID = "k1";
const ADMIN = staffMember("admin@zsm3.test", "admin", true);
const EDITOR = staffMember("foto@zsm3.test", "gallery_editor", true);
const SALON = sampleNews("salon-maturzystow", "Salon Maturzystow");
const STORE = { db: env.DB, clock: TEST_CLOCK, random: cryptoRandom };
const CLAIMS = {
  iss: ISSUER,
  aud: [AUDIENCE],
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};

let adminToken = "brak";
let editorToken = "brak";
let app: Hono<AppEnv>;

function jsonRequest(method: string, path: string, token: string, body?: unknown): Request {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["origin"] = ORIGIN;
    headers["content-type"] = "application/json";
  }
  const payload = {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  return new Request(`${ORIGIN}/api/panel${path}`, payload);
}

async function newToken(email: string, keys: { privateKey: CryptoKey }): Promise<string> {
  return new CompactSign(new TextEncoder().encode(JSON.stringify({ email, ...CLAIMS })))
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
    .sign(keys.privateKey);
}

describe("panel API on D1", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await staffRepo(STORE).save(ADMIN);
    await staffRepo(STORE).save(EDITOR);
    const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
    const jwk = { alg: "ES256", kid: KEY_ID, ...(await exportJWK(publicKey)) };
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const verifier: AccessVerifier = createAccessVerifier({
      jwks,
      audience: AUDIENCE,
      issuer: ISSUER,
      now: VERIFIER_CLOCK,
    });
    app = createApp({ verifier, origin: ORIGIN });
    adminToken = await newToken(ADMIN.email, { privateKey });
    editorToken = await newToken(EDITOR.email, { privateKey });
  });

  it("saves news through the API and writes its audit record", async ({ expect }) => {
    const created = await app.fetch(
      jsonRequest("POST", "/news", adminToken, newsSaveMutation(SALON)),
      env,
    );
    expect(created.status).toBe(201);

    const records = await auditRepo(STORE).byEntity("news", "2026/salon-maturzystow", 10);
    const record = records[0];
    if (record === undefined) {
      throw new Error("fixture");
    }
    expect(record.action).toBe("news.create");
    expect(record.actorEmail).toBe(ADMIN.email);

    const listed = await app.fetch(jsonRequest("GET", "/news?status=draft", adminToken), env);
    const raw: unknown = await listed.json();
    expect(panelNewsListSchema.parse(raw).items.map((item) => item.slug)).toEqual([
      "salon-maturzystow",
    ]);
  });

  it("stores the previous news data as a revision on update", async ({ expect }) => {
    const changed = sampleNews("salon-maturzystow", "Salon Maturzystow 2026");
    const updated = await app.fetch(
      jsonRequest("PUT", "/news/2026/salon-maturzystow", adminToken, newsSaveMutation(changed)),
      env,
    );
    expect(updated.status).toBe(200);

    const revisions = await revisionsRepo(STORE).list("news", "2026/salon-maturzystow");
    const revision = revisions[0];
    if (revision === undefined) {
      throw new Error("fixture");
    }
    expect(revision.revision).toBe(1);
    const stored: unknown = JSON.parse(revision.dataJson);
    expect(stored).toEqual({ ...SALON, status: "draft" });

    const updates = (await auditRepo(STORE).byEntity("news", "2026/salon-maturzystow", 10)).find(
      (row) => row.action === "news.update",
    );
    if (updates === undefined) {
      throw new Error("fixture");
    }
    const fields: unknown = JSON.parse(updates.details);
    expect(fields).toEqual({ fields: ["title"] });

    const raw: unknown = await (
      await app.fetch(jsonRequest("GET", "/news", adminToken), env)
    ).json();
    expect(panelNewsListSchema.parse(raw).items.map((item) => item.title)).toEqual([
      "Salon Maturzystow 2026",
    ]);
  });

  it("publishes drafts through the patch route and revisions both flips", async ({ expect }) => {
    const published = await app.fetch(
      jsonRequest(
        "PATCH",
        "/news/2026/salon-maturzystow",
        adminToken,
        newsStatusMutation("publish"),
      ),
      env,
    );
    expect(published.status).toBe(200);

    const raw: unknown = await (
      await app.fetch(jsonRequest("GET", "/news", adminToken), env)
    ).json();
    const page = panelNewsListSchema.parse(raw);
    expect(page.items[0]?.status).toBe("published");

    const unpublish = await app.fetch(
      jsonRequest(
        "PATCH",
        "/news/2026/salon-maturzystow",
        adminToken,
        newsStatusMutation("unpublish"),
      ),
      env,
    );
    expect(unpublish.status).toBe(200);

    const revisions = await revisionsRepo(STORE).list("news", "2026/salon-maturzystow");
    expect(revisions.map((row) => row.revision)).toEqual([1, 2, 3]);
    expect(revisions[1]?.dataJson).toBe(
      JSON.stringify({ ...SALON, title: "Salon Maturzystow 2026", status: "draft" }),
    );
    expect(revisions[2]?.dataJson).toBe(
      JSON.stringify({ ...SALON, title: "Salon Maturzystow 2026", status: "published" }),
    );
  });

  it("rejects roles outside the content matrix", async ({ expect }) => {
    const response = await app.fetch(
      jsonRequest("POST", "/news", editorToken, newsSaveMutation(SALON)),
      env,
    );
    expect(response.status).toBe(403);
    const problem: unknown = await response.json();
    expect(problemDetailsSchema.parse(problem).title).toBe("Forbidden");
  });

  it("answers /me with the staff role", async ({ expect }) => {
    const response = await app.fetch(jsonRequest("GET", "/me", adminToken), env);
    const raw: unknown = await response.json();
    expect(panelMeSchema.parse(raw)).toEqual({ email: ADMIN.email, role: "admin" });
  });
});
