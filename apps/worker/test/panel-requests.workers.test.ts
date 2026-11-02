import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import { panelRequestDetailSchema, type PanelRequestDetail } from "@zsm3/contracts/requests";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { Hono } from "hono";
import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, it } from "vitest";

import type { AppEnv } from "../src/app-env.ts";
import { createApp } from "../src/app.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { createAccessVerifier, type AccessVerifier } from "../src/security/access-jwt.ts";
import { piiCrypto } from "../src/security/pii-crypto.ts";
import { auditRepo } from "../src/storage/audit-repo.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const ISSUER = "https://cloudflareaccess.example";
const AUDIENCE = "acc.tag";
const TEST_CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");
const VERIFIER_CLOCK = (): Date => new Date(1_850_000_000_000);
const KEY_ID = "k1";

const SECRETARIAT = staffMember("sekretariat@zsm3.test", "secretariat", true);
const EDITOR = staffMember("redaktor@zsm3.test", "editor", true);
const STORE = { db: env.DB, clock: TEST_CLOCK, random: cryptoRandom };
const CLAIMS = {
  iss: ISSUER,
  aud: [AUDIENCE],
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};

const PII_SECRET = "a".repeat(32);
const cryptoHelper = piiCrypto({ PRIMARY: PII_SECRET }, "PRIMARY", cryptoRandom);

const SAMPLE_PII = JSON.stringify({
  firstName: "Jan",
  lastName: "Kowalski",
  className: "4ta",
  email: "jan.kowalski@zsm3.test",
  note: "Prosze o szybkie wydanie",
  statusToken: "b".repeat(43),
});

let token = "brak";
let editorToken = "brak";
let app: Hono<AppEnv>;

function jsonRequest(method: string, path: string, bearer?: string, body?: unknown): Request {
  const headers: Record<string, string> = {};
  if (bearer !== undefined) {
    headers["authorization"] = `Bearer ${bearer}`;
  }
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

async function newToken(email: string, privateKey: CryptoKey): Promise<string> {
  return new CompactSign(new TextEncoder().encode(JSON.stringify({ email, ...CLAIMS })))
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
    .sign(privateKey);
}

describe("panel requests API on workerd", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await staffRepo(STORE).save(SECRETARIAT);
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
    app = createApp({ verifier, origin: ORIGIN, piiCrypto: cryptoHelper });
    token = await newToken(SECRETARIAT.email, privateKey);
    editorToken = await newToken(EDITOR.email, privateKey);
  });

  it("lists, views and transitions requests on workerd", async ({ expect }) => {
    const id = "77777777-7777-4777-8777-777777777777";
    const encrypted = await cryptoHelper.encrypt(SAMPLE_PII, id);
    await requestsRepo(STORE).create({
      id,
      type: "STUDENT_ID_RENEWAL",
      piiCiphertext: encrypted.ciphertext,
      piiKeyId: encrypted.keyId,
      emailIndex: cryptoRandom(32),
      statusTokenHash: cryptoRandom(32),
      formKey: crypto.randomUUID(),
    });

    expect((await app.fetch(jsonRequest("GET", "/requests"), env)).status).toBe(401);

    const listRes = await app.fetch(jsonRequest("GET", "/requests", token), env);
    expect(listRes.status).toBe(200);
    const list = panelRequestsListSchema.parse(await listRes.json());
    expect(list.items.map((item) => item.id)).toEqual([id]);

    const getRes = await app.fetch(jsonRequest("GET", `/requests/${id}`, token), env);
    expect(getRes.status).toBe(200);
    const detail: PanelRequestDetail = panelRequestDetailSchema.parse(await getRes.json());
    expect(detail).toMatchObject({
      firstName: "Jan",
      lastName: "Kowalski",
      email: "jan.kowalski@zsm3.test",
    });

    expect((await app.fetch(jsonRequest("GET", `/requests/${id}`, editorToken), env)).status).toBe(
      403,
    );

    const ready = await app.fetch(
      jsonRequest("POST", `/requests/${id}/status`, token, { to: "ready" }),
      env,
    );
    expect(ready.status).toBe(422);

    for (const to of ["in_progress", "ready"] as const) {
      const response = await app.fetch(
        jsonRequest("POST", `/requests/${id}/status`, token, { to }),
        env,
      );
      expect(response.status).toBe(200);
    }

    const outboxRows = await env.DB.prepare(
      "SELECT kind FROM email_outbox WHERE request_id = ? AND kind = 'READY_NOTICE'",
    )
      .bind(id)
      .all();
    expect(outboxRows.results).toHaveLength(1);

    const audits = await auditRepo(STORE).byEntity("requests", id, 10);
    expect(audits).toHaveLength(2);
    expect(audits[0]?.actorEmail).toBe(SECRETARIAT.email);
    expect(JSON.stringify(audits)).not.toMatch(/Jan|Kowalski|jan\.kowalski/u);
  });
});
