import { panelAlbumSchema, panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, it } from "vitest";
import { z } from "zod";

import { fileOf, photoForm } from "./node/gallery-form.ts";
import { staffMember } from "./node/panel-fixtures.ts";
import { vp8Webp } from "./node/webp-fixtures.ts";
import { ORIGIN } from "./support.ts";
import { createApp } from "../src/app.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const EDITOR = "galeria@zsm3.test";
const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };
const app = createApp({
  verifier: async (token) =>
    await Promise.resolve({
      email: token,
      exp: 2_000_000_000,
      iat: 1_800_000_000,
      nbf: 1_850_000_000,
      aud: "acc.tag",
    }),
  origin: ORIGIN,
});

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${EDITOR}`, origin: ORIGIN, ...extra };
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await staffRepo(store).save(staffMember(EDITOR, "gallery_editor", true));
});

it("creates an album and stores a photo in real D1 and R2", async ({ expect }) => {
  const created = await app.fetch(
    new Request(`${ORIGIN}/api/panel/albums`, {
      method: "POST",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify({
        schoolYear: "2026/2027",
        slug: "dzien-patrona",
        title: "Dzień patrona",
        description: "",
      }),
    }),
    env,
  );
  expect(created.status).toBe(201);
  const { item: album } = z.object({ item: panelAlbumSchema }).parse(await created.json());
  const large = vp8Webp(1600, 900, [1, 0]);
  const uploaded = await app.fetch(
    new Request(`${ORIGIN}/api/panel/albums/${album.id}/photos`, {
      method: "POST",
      headers: headers(),
      body: photoForm({
        small: fileOf(vp8Webp(400, 225)),
        large: fileOf(large),
        alt: "Uczniowie na apelu",
        consent: "true",
      }),
    }),
    env,
  );
  expect(uploaded.status).toBe(201);
  const { item } = panelPhotoUploadSchema.parse(await uploaded.json());
  const object = await env.MEDIA.get(photoKey(item.sha256, "l"));
  expect(object?.size).toBe(large.length);
  await object?.body.cancel();
  const small = await env.MEDIA.get(photoKey(item.sha256, "s"));
  await small?.body.cancel();
  expect(small).not.toBeNull();
});
