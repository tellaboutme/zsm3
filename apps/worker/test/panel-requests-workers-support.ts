import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { Hono } from "hono";
import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";

import type { AppEnv } from "../src/app-env.ts";
import { createApp } from "../src/app.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { createAccessVerifier } from "../src/security/access-jwt.ts";
import { piiCrypto } from "../src/security/pii-crypto.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { requestsRepo } from "../src/storage/requests-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const ISSUER = "https://cloudflareaccess.example";
const AUDIENCE = "acc.tag";
const TEST_CLOCK = (): Date => new Date("2026-10-22T08:00:00Z");
const VERIFIER_CLOCK = (): Date => new Date(1_850_000_000_000);
const KEY_ID = "k1";
const CLAIMS = {
  iss: ISSUER,
  aud: [AUDIENCE],
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};

export const SECRETARIAT = staffMember("sekretariat@zsm3.test", "secretariat", true);
export const ADMIN = staffMember("admin@zsm3.test", "admin", true);
export const EDITOR = staffMember("redaktor@zsm3.test", "editor", true);
export const STORE = { db: env.DB, clock: TEST_CLOCK, random: cryptoRandom };
export const CRYPTO = piiCrypto({ PRIMARY: "a".repeat(32) }, "PRIMARY", cryptoRandom);

export const SAMPLE_PII = JSON.stringify({
  firstName: "Jan",
  lastName: "Kowalski",
  className: "4ta",
  email: "jan.kowalski@zsm3.test",
  note: "Prosze o szybkie wydanie",
  statusToken: "b".repeat(43),
});

export interface PanelOnWorkerd {
  readonly app: Hono<AppEnv>;
  readonly tokens: Readonly<Record<"secretariat" | "admin" | "editor", string>>;
}

export function jsonRequest(
  method: string,
  path: string,
  bearer?: string,
  body?: unknown,
): Request {
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

async function sign(email: string, privateKey: CryptoKey): Promise<string> {
  return new CompactSign(new TextEncoder().encode(JSON.stringify({ email, ...CLAIMS })))
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
    .sign(privateKey);
}

export async function panelOnWorkerd(): Promise<PanelOnWorkerd> {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  for (const member of [SECRETARIAT, ADMIN, EDITOR]) {
    await staffRepo(STORE).save(member);
  }
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = { alg: "ES256", kid: KEY_ID, ...(await exportJWK(publicKey)) };
  const verifier = createAccessVerifier({
    jwks: createLocalJWKSet({ keys: [jwk] }),
    audience: AUDIENCE,
    issuer: ISSUER,
    now: VERIFIER_CLOCK,
  });
  return {
    app: createApp({ verifier, origin: ORIGIN, piiCrypto: CRYPTO }),
    tokens: {
      secretariat: await sign(SECRETARIAT.email, privateKey),
      admin: await sign(ADMIN.email, privateKey),
      editor: await sign(EDITOR.email, privateKey),
    },
  };
}

export async function seedEncryptedRequest(id: string): Promise<void> {
  const encrypted = await CRYPTO.encrypt(SAMPLE_PII, id);
  await requestsRepo(STORE).create({
    id,
    type: "STUDENT_ID_RENEWAL",
    piiCiphertext: encrypted.ciphertext,
    piiKeyId: encrypted.keyId,
    emailIndex: cryptoRandom(32),
    statusTokenHash: cryptoRandom(32),
    formKey: crypto.randomUUID(),
  });
}

export interface SideEffects {
  readonly status: string | undefined;
  readonly notices: readonly string[];
  readonly actors: readonly string[];
}

export async function sideEffects(id: string): Promise<SideEffects> {
  const outbox = await env.DB.prepare(
    "SELECT kind FROM email_outbox WHERE request_id = ? AND kind IN ('READY_NOTICE', 'REJECTED_NOTICE') ORDER BY kind",
  )
    .bind(id)
    .all<{ kind: string }>();
  const audits = await env.DB.prepare(
    "SELECT actor_email FROM audit_log WHERE entity = 'requests' AND entity_id = ? ORDER BY actor_email",
  )
    .bind(id)
    .all<{ actor_email: string }>();
  const row = await env.DB.prepare("SELECT status FROM requests WHERE id = ?")
    .bind(id)
    .first<{ status: string }>();
  return {
    status: row?.status,
    notices: outbox.results.map((item) => item.kind),
    actors: audits.results.map((item) => item.actor_email),
  };
}
