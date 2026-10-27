import type { ProblemDetails } from "@zsm3/contracts/problem";
import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from "@zsm3/contracts/problem";
import type { Hono } from "hono";
import type { LocalJWKSet } from "jose";
import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { expect } from "vitest";

import { memoryDatabase } from "./memory-database.ts";
import { createApp } from "../../src/app.ts";
import { DEFAULT_PANEL_ORIGIN } from "../../src/routes/panel/deps.ts";
import type { MediaBucket, PanelRuntimeEnv } from "../../src/routes/panel/deps.ts";
import type { AccessVerifier } from "../../src/security/access-jwt.ts";
import { createAccessVerifier } from "../../src/security/access-jwt.ts";
import { auditRepo, type AuditRepo } from "../../src/storage/audit-repo.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { revisionsRepo, type RevisionsRepo } from "../../src/storage/revisions-repo.ts";
import { staffRepo, type StaffInput } from "../../src/storage/staff-repo.ts";

export type PanelBody = NonNullable<RequestInit["body"]>;

export const PANEL_AUDIENCE = "acc.tag";
export const PANEL_DOMAIN = "cloudflareaccess.example";
export const PANEL_ISSUER = "https://cloudflareaccess.example";
export const PANEL_ORIGIN = "https://panel.zsm3.test";
export const VERIFIER_CLOCK = (): Date => new Date(1_850_000_000_000);

const KEY_ID = "k1";

export const CLAIM_BASE = {
  iss: PANEL_ISSUER,
  aud: [PANEL_AUDIENCE],
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};

export interface PanelKeys {
  readonly document: string;
  readonly jwks: LocalJWKSet;
  readonly sign: (claims: Record<string, unknown>) => Promise<string>;
}

export interface PanelHarness {
  readonly app: Hono<PanelRuntimeEnv>;
  readonly env: Env;
  readonly keys: PanelKeys;
}

export function memoryBucket(): MediaBucket {
  const stored = new Map<string, ArrayBuffer>();
  return {
    get: async (key) => {
      const value = await Promise.resolve(stored.get(key));
      if (value === undefined) {
        return null;
      }
      return { body: new Blob([value]).stream(), size: value.byteLength, httpEtag: `etag-${key}` };
    },
    put: async (key, value) => {
      await Promise.resolve(stored.set(key, value));
    },
  };
}

export function panelEnv(): Env {
  return {
    DB: memoryDatabase(),
    MEDIA: memoryBucket(),
    ACCESS_TEAM_DOMAIN: PANEL_DOMAIN,
    ACCESS_AUDIENCE: PANEL_AUDIENCE,
    PANEL_ORIGIN: DEFAULT_PANEL_ORIGIN,
  };
}

export async function panelKeys(): Promise<PanelKeys> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = { alg: "ES256", kid: KEY_ID, ...(await exportJWK(publicKey)) };
  const sign = async (claims: Record<string, unknown>): Promise<string> =>
    new CompactSign(new TextEncoder().encode(JSON.stringify(claims)))
      .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
      .sign(privateKey);
  return {
    document: JSON.stringify({ keys: [jwk] }),
    jwks: createLocalJWKSet({ keys: [jwk] }),
    sign,
  };
}

export async function panelHarness(): Promise<PanelHarness> {
  const keys = await panelKeys();
  const verifier: AccessVerifier = createAccessVerifier({
    jwks: keys.jwks,
    audience: PANEL_AUDIENCE,
    issuer: PANEL_ISSUER,
    now: VERIFIER_CLOCK,
  });
  return { app: createApp({ verifier, origin: PANEL_ORIGIN }), env: panelEnv(), keys };
}

export async function panelEnvHarness(): Promise<PanelHarness> {
  return { app: createApp(), env: panelEnv(), keys: await panelKeys() };
}

export async function panelVerifierHarness(): Promise<PanelHarness> {
  const keys = await panelKeys();
  const verifier: AccessVerifier = createAccessVerifier({
    jwks: keys.jwks,
    audience: PANEL_AUDIENCE,
    issuer: PANEL_ISSUER,
    now: VERIFIER_CLOCK,
  });
  return { app: createApp({ verifier }), env: panelEnv(), keys };
}

export function staffClaims(
  email: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { email, ...CLAIM_BASE, ...overrides };
}

export async function seedStaff(env: Env, entries: readonly StaffInput[]): Promise<void> {
  const repo = staffRepo({ db: env.DB, clock: systemClock, random: cryptoRandom });
  for (const entry of entries) {
    await repo.save(entry);
  }
}

export function panelAudit(env: Env): AuditRepo {
  return auditRepo({ db: env.DB, clock: systemClock, random: cryptoRandom });
}

export function panelRevisions(env: Env): RevisionsRepo {
  return revisionsRepo({ db: env.DB, clock: systemClock, random: cryptoRandom });
}

export const PANEL_API_PREFIX = "/api/panel";

export function panelUrl(path: string): string {
  return `${PANEL_ORIGIN}${PANEL_API_PREFIX}${path}`;
}

export async function expectProblem(response: Response, status: number): Promise<ProblemDetails> {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
  const payload: unknown = await response.json();
  return problemDetailsSchema.parse(payload);
}

export function panelJsonRequest(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Request {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["origin"] = PANEL_ORIGIN;
    headers["content-type"] = "application/json";
  }
  const payload = {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  return new Request(panelUrl(path), payload);
}

export function panelRawRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: PanelBody,
): Request {
  const payload = { method, headers, ...(body === undefined ? {} : { body }) };
  return new Request(panelUrl(path), payload);
}

export interface PanelJsonInit {
  readonly token: string;
  readonly body?: unknown;
}

export interface PanelRawInit {
  readonly headers: Record<string, string>;
  readonly body?: PanelBody;
}

export async function panelJsonCall(
  harness: PanelHarness,
  method: string,
  path: string,
  init: PanelJsonInit,
): Promise<Response> {
  return harness.app.fetch(panelJsonRequest(method, path, init.token, init.body), harness.env);
}

export async function panelRawCall(
  harness: PanelHarness,
  method: string,
  path: string,
  init: PanelRawInit,
): Promise<Response> {
  return harness.app.fetch(panelRawRequest(method, path, init.headers, init.body), harness.env);
}

export function panelUploadRequest(token: string, file: File): Request {
  const form = new FormData();
  form.set("file", file);
  return new Request(panelUrl("/files"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: PANEL_ORIGIN },
    body: form,
  });
}
