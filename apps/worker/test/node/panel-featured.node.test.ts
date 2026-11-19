import {
  panelFeaturedListSchema,
  publicFeaturedPhotoSchema,
  type PublicFeaturedPhoto,
} from "@zsm3/contracts/featured";
import { it } from "vitest";
import type { z } from "zod";

import { createAlbum, galleryToken, uploadPhoto } from "./gallery-support.ts";
import type { PanelHarness } from "./panel-support.ts";
import { expectProblem, panelAudit, panelHarness, panelJsonCall } from "./panel-support.ts";
import { liveStore } from "../../src/storage/database.ts";
import { featuredRepo } from "../../src/storage/featured-repo.ts";

interface Gallery {
  readonly harness: PanelHarness;
  readonly token: string;
  readonly albumId: string;
  readonly photoId: string;
}

const MISSING = "00000000-0000-4000-8000-000000000000";

async function gallery(): Promise<Gallery> {
  const harness = await panelHarness();
  const token = await galleryToken(harness);
  const album = await createAlbum(harness, token);
  const photo = await uploadPhoto(harness, album.id, token);
  return { harness, token, albumId: album.id, photoId: photo.id };
}

async function listed({
  harness,
  token,
}: Gallery): Promise<z.infer<typeof panelFeaturedListSchema>> {
  const response = await panelJsonCall(harness, "GET", "/featured", { token });
  return panelFeaturedListSchema.parse(await response.json());
}

async function feature(g: Gallery, slot: string, photoId = g.photoId): Promise<Response> {
  return panelJsonCall(g.harness, "PUT", `/featured/${slot}`, {
    token: g.token,
    body: { photoId },
  });
}

async function publish(g: Gallery): Promise<void> {
  await panelJsonCall(g.harness, "PATCH", `/albums/${g.albumId}`, {
    token: g.token,
    body: { action: "publish" },
  });
}

async function published(g: Gallery): Promise<readonly PublicFeaturedPhoto[]> {
  return featuredRepo(liveStore(g.harness.env.DB)).published();
}

it("features a photo, lists it and audits the change", async ({ expect }) => {
  const g = await gallery();

  const saved = await feature(g, "home");
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ ok: true });
  const { items } = await listed(g);
  expect(items).toEqual([
    expect.objectContaining({
      slot: "home",
      photoId: g.photoId,
      albumId: g.albumId,
      published: false,
    }),
  ]);
  const [audit] = await panelAudit(g.harness.env).byEntity("featured", "home", 1);
  expect(audit?.action).toBe("featured.set");
});

it("shows a featured photo publicly only while its album is published", async ({ expect }) => {
  const g = await gallery();
  await feature(g, "film");

  expect(await published(g)).toEqual([]);
  await publish(g);
  const [item] = await published(g);
  expect(publicFeaturedPhotoSchema.parse(item).slot).toBe("film");
  expect(Object.keys(item ?? {}).sort()).toEqual(["alt", "height", "sha256", "slot", "width"]);
});

it("replaces the photo of a slot and keeps one row per slot", async ({ expect }) => {
  const g = await gallery();
  const second = await uploadPhoto(g.harness, g.albumId, g.token, 2);

  await feature(g, "kandydaci");
  await feature(g, "kandydaci", second.id);
  await feature(g, "szkola");
  const { items } = await listed(g);
  expect(items.map(({ slot, photoId }) => [slot, photoId])).toEqual([
    ["kandydaci", second.id],
    ["szkola", g.photoId],
  ]);
});

it("clears a slot, audits it and answers 404 for an empty one", async ({ expect }) => {
  const g = await gallery();
  await feature(g, "rodzice");

  const cleared = await panelJsonCall(g.harness, "DELETE", "/featured/rodzice", {
    token: g.token,
    body: {},
  });
  expect(cleared.status).toBe(204);
  expect((await listed(g)).items).toEqual([]);
  const [audit] = await panelAudit(g.harness.env).byEntity("featured", "rodzice", 1);
  expect(audit?.action).toBe("featured.clear");
  await expectProblem(
    await panelJsonCall(g.harness, "DELETE", "/featured/rodzice", { token: g.token, body: {} }),
    404,
  );
});

it("drops a slot whose photo was deleted or purged", async ({ expect }) => {
  const g = await gallery();
  await feature(g, "uczniowie");

  await panelJsonCall(g.harness, "DELETE", `/albums/${g.albumId}/photos/${g.photoId}`, {
    token: g.token,
    body: {},
  });
  expect((await listed(g)).items).toEqual([]);
  await expectProblem(
    await panelJsonCall(g.harness, "DELETE", "/featured/uczniowie", { token: g.token, body: {} }),
    404,
  );
  await g.harness.env.DB.prepare("DELETE FROM photos WHERE id = ?").bind(g.photoId).run();
  const rows = await g.harness.env.DB.prepare("SELECT COUNT(*) AS n FROM featured_photos").first();
  expect(rows).toEqual({ n: 0 });
});

it("rejects unknown slots, malformed bodies and photos that are not live", async () => {
  const g = await gallery();

  await expectProblem(await feature(g, "galeria"), 404);
  await expectProblem(
    await panelJsonCall(g.harness, "DELETE", "/featured/galeria", { token: g.token, body: {} }),
    404,
  );
  await expectProblem(
    await panelJsonCall(g.harness, "PUT", "/featured/home", {
      token: g.token,
      body: { photoId: "x" },
    }),
    422,
  );
  const missing = await expectProblem(await feature(g, "home", MISSING), 422);
  if (missing.title !== "Photo Not Found") {
    throw new Error(missing.title);
  }
});
