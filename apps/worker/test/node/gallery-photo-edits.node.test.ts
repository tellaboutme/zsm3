import { panelAlbumViewSchema, panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";
import { z } from "zod";

import {
  bucketBytes,
  createAlbum,
  galleryToken,
  photoParts,
  uploadCall,
  uploadPhoto,
} from "./gallery-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  type PanelHarness,
} from "./panel-support.ts";
import type { AuditRecord } from "../../src/storage/audit-repo.ts";

const itemSchema = z.object({ item: z.object({ alt: z.string() }) });
const UNKNOWN = "01890a5d-ac96-7abc-8def-0123456789ab";

let harness: PanelHarness;
let token: string;
let albumId: string;

beforeEach(async () => {
  harness = await panelHarness();
  token = await galleryToken(harness);
  albumId = (await createAlbum(harness, token)).id;
});

async function auditOf(action: string): Promise<AuditRecord | undefined> {
  const audit = await panelAudit(harness.env).list(50);
  return audit.find((entry) => entry.action === action);
}

async function auditActions(): Promise<readonly string[]> {
  const audit = await panelAudit(harness.env).list(50);
  return audit.map((entry) => entry.action);
}

async function albumView(id: string): Promise<z.infer<typeof panelAlbumViewSchema>> {
  const response = await panelJsonCall(harness, "GET", `/albums/${id}`, { token });
  return panelAlbumViewSchema.parse(await response.json());
}

async function removePhoto(photoId: string, album = albumId): Promise<Response> {
  return panelJsonCall(harness, "DELETE", `/albums/${album}/photos/${photoId}`, {
    token,
    body: {},
  });
}

describe("repeated photos", () => {
  it("answers a repeat in the same album without changing anything", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    const before = await auditActions();
    const response = await uploadCall(harness, albumId, token, photoParts(1, { alt: "Inny opis" }));
    expect(response.status).toBe(200);
    const body = panelPhotoUploadSchema.parse(await response.json());
    expect(body).toEqual({ item: photo, duplicate: true });
    expect(await auditActions()).toEqual(before);
    expect((await albumView(albumId)).photos).toEqual([photo]);
  });

  it("refuses a photo that is live in another album", async ({ expect }) => {
    await uploadPhoto(harness, albumId, token);
    const other = await createAlbum(harness, token, { slug: "inny" });
    const response = await uploadCall(harness, other.id, token, photoParts());
    expect((await expectProblem(response, 409)).title).toBe("Photo In Another Album");
    expect((await albumView(other.id)).photos).toEqual([]);
  });

  it("restores a deleted photo with the new consent and alt", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await removePhoto(photo.id);
    const other = await createAlbum(harness, token, { slug: "inny" });
    await uploadPhoto(harness, other.id, token, 5);
    const response = await uploadCall(
      harness,
      other.id,
      token,
      photoParts(1, { alt: "Nowy opis" }),
    );
    expect(response.status).toBe(201);
    const body = panelPhotoUploadSchema.parse(await response.json());
    expect(body.duplicate).toBe(false);
    expect(body.item).toMatchObject({
      id: photo.id,
      albumId: other.id,
      position: 1,
      alt: "Nowy opis",
    });
    expect(await auditActions()).toContain("photos.restore");
  });

  it("moves a photo out of a deleted album", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await panelJsonCall(harness, "DELETE", `/albums/${albumId}`, { token, body: {} });
    const other = await createAlbum(harness, token, { slug: "inny" });
    const response = await uploadCall(harness, other.id, token, photoParts());
    expect(response.status).toBe(201);
    const body = panelPhotoUploadSchema.parse(await response.json());
    expect(body.item).toMatchObject({ id: photo.id, albumId: other.id, position: 0 });
  });
});

describe("photo edits", () => {
  it("changes the alt text and audits the field", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    const path = `/albums/${albumId}/photos/${photo.id}`;
    const response = await panelJsonCall(harness, "PATCH", path, {
      token,
      body: { alt: "Poprawiony opis" },
    });
    expect(response.status).toBe(200);
    expect(itemSchema.parse(await response.json()).item.alt).toBe("Poprawiony opis");
    expect(await auditOf("photos.update")).toMatchObject({
      action: "photos.update",
      entityId: photo.id,
      details: JSON.stringify({ fields: ["alt"] }),
    });
    await expectProblem(
      await panelJsonCall(harness, "PATCH", path, { token, body: { alt: "" } }),
      422,
    );
  });

  it("audits no field when the alt text stays the same", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await panelJsonCall(harness, "PATCH", `/albums/${albumId}/photos/${photo.id}`, {
      token,
      body: { alt: photo.alt },
    });
    expect((await auditOf("photos.update"))?.details).toBe(JSON.stringify({ fields: [] }));
  });

  it("names no publication change for a hidden album", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await removePhoto(photo.id);
    expect((await auditOf("photos.delete"))?.details).toBe(
      JSON.stringify({ fields: ["deletedAt"] }),
    );
  });

  it("deletes softly and keeps a photo out of the album", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await uploadPhoto(harness, albumId, token, 2);
    expect((await removePhoto(photo.id)).status).toBe(204);
    const view = await albumView(albumId);
    expect(view.item.photoCount).toBe(1);
    expect(view.photos.map((item) => item.id)).not.toContain(photo.id);
    await expectProblem(await removePhoto(photo.id), 404);
    const row = await harness.env.DB.prepare("SELECT deleted_at FROM photos WHERE id = ?")
      .bind(photo.id)
      .first();
    const stored = z.object({ deleted_at: z.string() }).parse(row);
    expect(stored.deleted_at.length).toBeGreaterThan(0);
    expect(await bucketBytes(harness.env, photoKey(photo.sha256, "l"))).toBeDefined();
  });

  it("keeps a published album public while photos remain", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await uploadPhoto(harness, albumId, token, 2);
    await panelJsonCall(harness, "PATCH", `/albums/${albumId}`, {
      token,
      body: { action: "publish" },
    });
    await removePhoto(photo.id);
    expect((await albumView(albumId)).item.publishedAt).not.toBeNull();
    expect((await auditOf("photos.delete"))?.details).toBe(
      JSON.stringify({ fields: ["deletedAt"] }),
    );
  });

  it("unpublishes an album when its last photo is deleted", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    await panelJsonCall(harness, "PATCH", `/albums/${albumId}`, {
      token,
      body: { action: "publish" },
    });
    expect((await removePhoto(photo.id)).status).toBe(204);
    expect((await albumView(albumId)).item.publishedAt).toBeNull();
    expect((await auditOf("photos.delete"))?.details).toBe(
      JSON.stringify({ fields: ["deletedAt", "albumPublishedAt"] }),
    );
  });

  it("refuses bad ids and photos of another album", async () => {
    const photo = await uploadPhoto(harness, albumId, token);
    const other = await createAlbum(harness, token, { slug: "inny" });
    await expectProblem(await removePhoto("invalid"), 422);
    await expectProblem(await removePhoto(UNKNOWN), 404);
    await expectProblem(await removePhoto(photo.id, other.id), 404);
    await expectProblem(await removePhoto(photo.id, UNKNOWN), 404);
    await expectProblem(await removePhoto(photo.id, "invalid"), 422);
    await expectProblem(
      await panelJsonCall(harness, "PATCH", `/albums/${albumId}/photos/${UNKNOWN}`, {
        token,
        body: { alt: "Opis" },
      }),
      404,
    );
  });
});
