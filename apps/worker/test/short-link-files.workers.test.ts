import { panelShortLinkCreatedSchema } from "@zsm3/contracts/panel";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { createApp } from "../src/app.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { FORM_CONTENT_TYPE } from "../src/http/form-body.ts";
import { sweepShortLinkFiles } from "../src/jobs/short-link-files.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { shortLinkFilesRepo } from "../src/storage/short-link-files-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const OWNER = "teacher@zsm3.test";
const OTHER = "other-teacher@zsm3.test";
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF\n");
const store = { db: env.DB, clock: () => new Date(), random: cryptoRandom };
const bindings = { ...env, SHORT_LINK_KEY: "workers-short-link-key-0123456789abcdef" };
const app = createApp({
  verifier: async (token) =>
    Promise.resolve({
      email: token,
      exp: 4_000_000_000,
      iat: 1_800_000_000,
      nbf: 1_800_000_000,
      aud: "acc.tag",
    }),
  origin: ORIGIN,
});

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  const staff = staffRepo(store);
  await staff.save(staffMember(OWNER, "editor", true));
  await staff.save(staffMember(OTHER, "editor", true));
});

async function uploadPdf(password: string): Promise<string> {
  const form = new FormData();
  form.set("file", new File([PDF], "Karta pracy.pdf", { type: "image/svg+xml" }));
  form.set("password", password);
  const response = await app.fetch(
    new Request(`${ORIGIN}/api/panel/short-links/files`, {
      method: "POST",
      headers: { authorization: `Bearer ${OWNER}`, origin: ORIGIN },
      body: form,
    }),
    bindings,
  );
  if (response.status !== 201) {
    throw new Error(`upload failed with ${String(response.status)}`);
  }
  return panelShortLinkCreatedSchema.parse(await response.json()).item.code;
}

async function unlock(code: string, password: string): Promise<Response> {
  return app.fetch(
    new Request(`${ORIGIN}/api/short-links/${code}`, {
      method: "POST",
      headers: { "content-type": FORM_CONTENT_TYPE, origin: ORIGIN },
      body: new URLSearchParams({ haslo: password }).toString(),
    }),
    bindings,
  );
}

async function privateKeys(): Promise<readonly string[]> {
  return (await env.MEDIA.list({ prefix: "s/" })).objects.map((object) => object.key);
}

describe("private file links on D1 and R2", () => {
  it("serves the file only after the password and never through /media", async ({ expect }) => {
    const code = await uploadPdf("klasa4tp");
    const keys = await privateKeys();
    expect(keys).toHaveLength(1);
    const [key] = keys;

    for (const path of [`/media/${key ?? ""}`, `/media/d/${(key ?? "").slice(2)}`]) {
      expect((await app.fetch(new Request(`${ORIGIN}${path}`), bindings)).status).toBe(404);
    }
    const wrong = await unlock(code, "zle-haslo");
    expect(wrong.status).toBe(303);
    expect(wrong.headers.get("location")).toBe(`/s/${code}?blad=haslo`);
    const right = await unlock(code, "klasa4tp");
    expect(right.status).toBe(200);
    expect(right.headers.get("content-disposition")).toContain("attachment;");
    expect(new Uint8Array(await right.arrayBuffer())).toEqual(PDF);

    const foreign = await app.fetch(
      new Request(`${ORIGIN}/api/panel/short-links/${code}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${OTHER}`,
          origin: ORIGIN,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      bindings,
    );
    expect(foreign.status).toBe(404);
    const revoked = await app.fetch(
      new Request(`${ORIGIN}/api/panel/short-links/${code}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${OWNER}`,
          origin: ORIGIN,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      bindings,
    );
    expect(revoked.status).toBe(204);
    expect((await unlock(code, "klasa4tp")).headers.get("location")).toBe(`/s/${code}`);

    await expect(
      sweepShortLinkFiles(shortLinkFilesRepo(store), env.MEDIA, new Date()),
    ).resolves.toBe(1);
    expect(await privateKeys()).toEqual([]);
  });
});
