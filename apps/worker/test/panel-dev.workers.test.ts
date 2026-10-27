import { panelMeSchema } from "@zsm3/contracts/panel";
import { problemDetailsSchema } from "@zsm3/contracts/problem";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { CompactSign, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

import { createApp } from "../src/app.ts";
import { newsSaveMutation, sampleNews, staffMember } from "./node/panel-fixtures.ts";
import { auditRepo } from "../src/storage/audit-repo.ts";
import { systemClock } from "../src/storage/database.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const DEV_TEAM_DOMAIN = "http://127.0.0.1:8799";
const DEV_AUDIENCE = "zsm3-dev";
const DEV_KEY_ID = "dev-local";
const DEV_JWKS_URL = `${DEV_TEAM_DOMAIN}/cdn-cgi/access/certs`;
const DEV_ADMIN = staffMember("dev@zsm3.local", "admin", true);
const STRANGER = "outsider@zsm3.local";
const NEWS = sampleNews("warsztaty-dev", "Warsztaty dev");
const STORE = { db: env.DB, clock: systemClock, random: cryptoRandom };

const realFetch = globalThis.fetch.bind(globalThis);

interface Keypair {
  readonly privateKey: CryptoKey;
  readonly document: string;
}

let keys: Keypair;
let token = "brak";
let outsiderToken = "brak";

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function stubJwksFetch(document: string): void {
  vi.stubGlobal(
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = requestUrl(input);
      if (url === DEV_JWKS_URL) {
        return new Response(document, {
          status: 200,
          headers: { "Content-Type": "application/jwk-set+json; charset=utf-8" },
        });
      }
      return realFetch(input, init);
    },
  );
}

function panelRequest(method: string, path: string, token: string, body?: unknown): Request {
  const headers: Record<string, string> = { "cf-access-jwt-assertion": token };
  if (body !== undefined) {
    headers["origin"] = env.PANEL_ORIGIN;
    headers["content-type"] = "application/json";
  }
  return new Request(`https://zsm3.test/api/panel${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function mint(email: string, privateKey: CryptoKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new CompactSign(
    new TextEncoder().encode(
      JSON.stringify({
        email,
        iss: DEV_TEAM_DOMAIN,
        aud: DEV_AUDIENCE,
        iat: now - 60,
        nbf: now - 60,
        exp: now + 600,
      }),
    ),
  )
    .setProtectedHeader({ alg: "ES256", kid: DEV_KEY_ID })
    .sign(privateKey);
}

describe("panel auth from the local development environment", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await staffRepo(STORE).save(DEV_ADMIN);
    const generated = await generateKeyPair("ES256", { extractable: true });
    const jwk = { alg: "ES256", kid: DEV_KEY_ID, ...(await exportJWK(generated.publicKey)) };
    keys = { privateKey: generated.privateKey, document: JSON.stringify({ keys: [jwk] }) };
    token = await mint(DEV_ADMIN.email, generated.privateKey);
    outsiderToken = await mint(STRANGER, generated.privateKey);
    stubJwksFetch(keys.document);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("answers the dev admin me route through real environment wiring", async ({ expect }) => {
    const response = await createApp().fetch(panelRequest("GET", "/me", token), env);
    expect(response.status).toBe(200);
    const raw: unknown = await response.json();
    expect(panelMeSchema.parse(raw)).toEqual({ email: DEV_ADMIN.email, role: "admin" });
  });

  it("creates news through the header token and audits it", async ({ expect }) => {
    const created = await createApp().fetch(
      panelRequest("POST", "/news", token, newsSaveMutation(NEWS)),
      env,
    );
    expect(created.status).toBe(201);

    const records = await auditRepo(STORE).byEntity("news", `2026/${NEWS.slug}`, 10);
    const record = records[0];
    if (record === undefined) {
      throw new Error("fixture");
    }
    expect(record.action).toBe("news.create");
    expect(record.actorEmail).toBe(DEV_ADMIN.email);
  });

  it("keeps anonymous and unsigned requests closed", async ({ expect }) => {
    expect((await createApp().fetch(panelRequest("GET", "/me", ""), env)).status).toBe(401);
    expect((await createApp().fetch(panelRequest("GET", "/me", token), env)).status).toBe(200);
  });

  it("rejects valid tokens for emails outside the staff table", async ({ expect }) => {
    const response = await createApp().fetch(panelRequest("GET", "/me", outsiderToken), env);
    expect(response.status).toBe(403);
    const problem: unknown = await response.json();
    expect(problemDetailsSchema.parse(problem).title).toBe("Forbidden");
  });
});
