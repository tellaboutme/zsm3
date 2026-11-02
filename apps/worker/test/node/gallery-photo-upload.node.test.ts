import { panelAlbumViewSchema, panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";
import type { z } from "zod";

import {
  bucketBytes,
  createAlbum,
  fileOf,
  galleryToken,
  GALLERY_EDITOR,
  photoParts,
  uploadCall,
  uploadPhoto,
} from "./gallery-support.ts";
import {
  expectProblem,
  PANEL_ORIGIN,
  panelAudit,
  panelHarness,
  panelJsonCall,
  panelUrl,
  type PanelHarness,
} from "./panel-support.ts";
import { chunk, riff, vp8Payload, vp8Webp } from "./webp-fixtures.ts";
import type { AuditRecord } from "../../src/storage/audit-repo.ts";

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

describe("photo upload", () => {
  it("stores both variants and records consent", async ({ expect }) => {
    const parts = photoParts();
    const response = await uploadCall(harness, albumId, token, parts);
    expect(response.status).toBe(201);
    const { item, duplicate } = panelPhotoUploadSchema.parse(await response.json());
    expect(duplicate).toBe(false);
    expect(item).toMatchObject({
      albumId,
      position: 0,
      width: 1600,
      height: 900,
      alt: "Uczniowie na apelu",
      consentBy: GALLERY_EDITOR,
    });
    expect(await bucketBytes(harness.env, photoKey(item.sha256, "l"))).toEqual(
      vp8Webp(1600, 900, [1, 0]),
    );
    expect(await bucketBytes(harness.env, photoKey(item.sha256, "s"))).toEqual(vp8Webp(400, 225));
    expect(await auditOf("photos.create")).toMatchObject({
      action: "photos.create",
      entity: "photos",
      entityId: item.id,
      details: JSON.stringify({ fields: ["albumId", "alt", "consent"] }),
    });
  });

  it("keeps stored photos off the public media route", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    const request = new Request(`${PANEL_ORIGIN}/media/${photoKey(photo.sha256, "l")}`);
    const response = await harness.app.fetch(request, harness.env);
    expect(response.status).toBe(404);
  });

  it("names the stored hash after the large variant", async ({ expect }) => {
    const large = vp8Webp(1600, 900, [1, 0]);
    const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(large));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const photo = await uploadPhoto(harness, albumId, token);
    expect(photo.sha256).toBe(hex);
  });

  it("appends behind every earlier photo, deleted ones included", async ({ expect }) => {
    const first = await uploadPhoto(harness, albumId, token, 1);
    const second = await uploadPhoto(harness, albumId, token, 2);
    await removePhoto(second.id);
    const third = await uploadPhoto(harness, albumId, token, 3);
    expect([first.position, second.position, third.position]).toEqual([0, 1, 2]);
  });

  it("requires consent, alt text and both files", async () => {
    for (const parts of [
      photoParts(1, { consent: "false" }),
      photoParts(1, { consent: "" }),
      photoParts(1, { alt: "   " }),
      photoParts(1, { alt: "x".repeat(301) }),
      photoParts(1, { small: "text" }),
      photoParts(1, { large: "text" }),
    ]) {
      await expectProblem(await uploadCall(harness, albumId, token, parts), 422);
    }
    const withoutConsent = {
      small: fileOf(vp8Webp(400, 225)),
      large: fileOf(vp8Webp(1600, 900)),
      alt: "Opis",
    };
    await expectProblem(await uploadCall(harness, albumId, token, withoutConsent), 422);
  });

  it("refuses a body that is not a form", async () => {
    const request = new Request(panelUrl(`/albums/${albumId}/photos`), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin: PANEL_ORIGIN },
      body: "not a form",
    });
    await expectProblem(await harness.app.fetch(request, harness.env), 422);
  });

  it("refuses files that are not clean WebP, whatever their name says", async ({ expect }) => {
    const svg = fileOf(new TextEncoder().encode("<svg></svg>"), "photo.webp");
    const withExif = fileOf(
      riff([chunk("VP8 ", vp8Payload(1600, 900)), chunk("EXIF")]),
      "photo.webp",
    );
    for (const parts of [
      photoParts(1, { small: svg }),
      photoParts(1, { large: svg }),
      photoParts(1, { large: withExif }),
      photoParts(1, { large: fileOf(new Uint8Array(0)) }),
    ]) {
      const problem = await expectProblem(await uploadCall(harness, albumId, token, parts), 422);
      expect(problem.title).toBe("Invalid Image");
    }
    expect(await albumView(albumId)).toMatchObject({ photos: [] });
  });

  it("refuses variants of the wrong size", async ({ expect }) => {
    for (const parts of [
      photoParts(1, { small: fileOf(vp8Webp(200, 112)) }),
      photoParts(1, { small: fileOf(vp8Webp(225, 400)) }),
      photoParts(1, { large: fileOf(vp8Webp(1601, 900)) }),
    ]) {
      const problem = await expectProblem(await uploadCall(harness, albumId, token, parts), 422);
      expect(problem.title).toBe("Invalid Image");
    }
  });
});
