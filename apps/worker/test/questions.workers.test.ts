import {
  panelQuestionDetailSchema,
  panelQuestionsListSchema,
  type PanelQuestionDetail,
} from "@zsm3/contracts/questions";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

import { staffMember } from "./node/panel-fixtures.ts";
import { outboundUrl } from "./requests-workers-helpers.ts";
import { createApp } from "../src/app.ts";
import { ACTIVE_PII_KEY_ID, piiKeys } from "../src/env.ts";
import { createQuestionsApp } from "../src/questions-app.ts";
import { createAccessVerifier } from "../src/security/access-jwt.ts";
import { piiCrypto } from "../src/security/pii-crypto.ts";
import { QUESTION_TURNSTILE_ACTION, TURNSTILE_VERIFY_URL } from "../src/security/turnstile.ts";
import { liveStore } from "../src/storage/database.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { questionsRepo } from "../src/storage/questions-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const ORIGIN = "https://zsm3.test";
const ISSUER = "https://cloudflareaccess.example";
const AUDIENCE = "acc.tag";
const CLAIMS = {
  iss: ISSUER,
  aud: [AUDIENCE],
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};
const TEXT = "Czy mogę przyjść do psychologa bez zgody rodziców? Jestem w drugiej klasie.";
const tokens: string[] = [];
let panel: ReturnType<typeof createApp>;

async function staffTokens(): Promise<readonly string[]> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk = { alg: "ES256", kid: "k1", ...(await exportJWK(publicKey)) };
  panel = createApp({
    verifier: createAccessVerifier({
      jwks: createLocalJWKSet({ keys: [jwk] }),
      audience: AUDIENCE,
      issuer: ISSUER,
      now: () => new Date(1_850_000_000_000),
    }),
    origin: ORIGIN,
    piiCrypto: piiCrypto(piiKeys(env), ACTIVE_PII_KEY_ID, cryptoRandom),
  });
  const sign = async (email: string) =>
    new CompactSign(new TextEncoder().encode(JSON.stringify({ email, ...CLAIMS })))
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .sign(privateKey);
  return Promise.all([sign("pedagog@zsm3.test"), sign("psycholog@zsm3.test")]);
}

async function staff(method: string, path: string, body?: unknown, who = 0): Promise<Response> {
  return panel.request(
    `${ORIGIN}/api/panel${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${tokens[who] ?? ""}`,
        ...(body === undefined ? {} : { origin: ORIGIN, "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}

async function ask(formKey = crypto.randomUUID()): Promise<Response> {
  return createQuestionsApp().request(
    `${ORIGIN}/api/questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": formKey },
      body: JSON.stringify({
        addressee: "psychologist",
        question: TEXT,
        rulesAccepted: true,
        honeypot: "",
        formKey,
        turnstileToken: "tok",
      }),
    },
    { ...env, SKRZYNKA_ENABLED: "true" },
  );
}

async function newest(): Promise<PanelQuestionDetail> {
  const list = panelQuestionsListSchema.parse(
    await (await staff("GET", "/questions?status=received")).json(),
  );
  const id = list.items[0]?.id ?? "";
  return panelQuestionDetailSchema.parse(await (await staff("GET", `/questions/${id}`)).json());
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const store = liveStore(env.DB);
  for (const email of ["pedagog@zsm3.test", "psycholog@zsm3.test"]) {
    await staffRepo(store).save(staffMember(email, "counsellor", true));
  }
  tokens.push(...(await staffTokens()));
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    if (outboundUrl(input) !== TURNSTILE_VERIFY_URL) {
      return Promise.reject(new Error(`Unexpected outbound fetch: ${outboundUrl(input)}`));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          action: QUESTION_TURNSTILE_ACTION,
          hostname: "zsm3.test",
          challenge_ts: new Date(Date.now() - 1000).toISOString(),
        }),
      ),
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("Skrzynka on workerd with D1", () => {
  it("takes a question, lets a counsellor publish it and then withdraw it", async ({ expect }) => {
    const received = await ask();
    const queued = await newest();
    const sealed = await env.DB.prepare(
      "SELECT question_ciphertext IS NOT NULL AS sealed, instr(CAST(question_ciphertext AS TEXT), 'psychologa') AS plain FROM questions WHERE id = ?",
    )
      .bind(queued.id)
      .first<{ sealed: number; plain: number | null }>();
    const drafted = await staff("PUT", `/questions/${queued.id}/draft`, {
      expectedVersion: 1,
      question: "Czy uczeń może przyjść do psychologa bez zgody rodziców?",
      answer: "Tak. Na rozmowę z psychologiem szkolnym możesz przyjść sam.",
    });
    const published = await staff("POST", `/questions/${queued.id}/decision`, {
      action: "publish",
      expectedVersion: 2,
      privacyReviewed: true,
    });
    const repo = questionsRepo(liveStore(env.DB));
    const [shown] = await repo.published(5, 0);
    const erased = await env.DB.prepare(
      "SELECT question_ciphertext IS NULL AS erased FROM questions WHERE id = ?",
    )
      .bind(queued.id)
      .first<{ erased: number }>();
    await staff("POST", `/questions/${queued.id}/decision`, {
      action: "withdraw",
      expectedVersion: 3,
    });

    expect([received.status, drafted.status]).toEqual([202, 200]);
    expect(queued).toMatchObject({ status: "received", question: TEXT, version: 1 });
    expect(sealed).toEqual({ sealed: 1, plain: 0 });
    expect(published.status).toBe(200);
    expect(shown).toMatchObject({
      question: "Czy uczeń może przyjść do psychologa bez zgody rodziców?",
    });
    expect(erased).toEqual({ erased: 1 });
    expect(await repo.publishedBySlug(shown?.slug ?? "")).toBeUndefined();
  });

  it("lets one of two simultaneous decisions through", async ({ expect }) => {
    await ask();
    const queued = await newest();

    const results = await Promise.all([
      staff("POST", `/questions/${queued.id}/decision`, { action: "reject", expectedVersion: 1 }),
      staff(
        "POST",
        `/questions/${queued.id}/decision`,
        { action: "delete", expectedVersion: 1 },
        1,
      ),
    ]);
    const audits = await env.DB.prepare(
      "SELECT count(*) AS total FROM audit_log WHERE entity = 'questions' AND entity_id = ?",
    )
      .bind(queued.id)
      .first<{ total: number }>();

    expect(results.map((response) => response.status).toSorted((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    expect(audits).toEqual({ total: 1 });
  });

  it("stores a resent form once", async ({ expect }) => {
    const count = async () =>
      (await env.DB.prepare("SELECT count(*) AS total FROM questions").first<number>("total")) ?? 0;
    const before = await count();
    const formKey = crypto.randomUUID();

    const statuses = [(await ask(formKey)).status, (await ask(formKey)).status];

    expect(statuses).toEqual([202, 202]);
    expect((await count()) - before).toBe(1);
  });

  it("refuses at the database level to publish without the public texts", async ({ expect }) => {
    await ask();
    const queued = await newest();

    await expect(
      env.DB.prepare("UPDATE questions SET status = 'published' WHERE id = ?")
        .bind(queued.id)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/u);
  });
});
