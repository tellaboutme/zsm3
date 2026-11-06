import type { AlbumInput, PanelAlbum, PanelPhoto } from "@zsm3/contracts/gallery";
import { panelAlbumSchema, panelPhotoUploadSchema } from "@zsm3/contracts/gallery";
import { z } from "zod";

import { fileOf, photoForm, type PhotoParts } from "./gallery-form.ts";
import { staffMember } from "./panel-fixtures.ts";
import {
  PANEL_ORIGIN,
  panelJsonCall,
  panelUrl,
  seedStaff,
  staffClaims,
  type PanelHarness,
} from "./panel-support.ts";
import { vp8Webp } from "./webp-fixtures.ts";

export { fileOf };

export const GALLERY_EDITOR = "galeria@zsm3.test";

export function albumInput(overrides: Partial<AlbumInput> = {}): AlbumInput {
  return {
    schoolYear: "2026/2027",
    slug: "dzien-patrona",
    title: "Dzień patrona",
    description: "Uroczystości szkolne.",
    ...overrides,
  };
}

export function photoParts(seed = 1, overrides: PhotoParts = {}): PhotoParts {
  return {
    small: fileOf(vp8Webp(400, 225)),
    large: fileOf(vp8Webp(1600, 900, [seed & 0xff, seed >>> 8])),
    alt: "Uczniowie na apelu",
    consent: "true",
    ...overrides,
  };
}

export async function uploadCall(
  harness: PanelHarness,
  albumId: string,
  token: string,
  parts: PhotoParts,
): Promise<Response> {
  const request = new Request(panelUrl(`/albums/${albumId}/photos`), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: PANEL_ORIGIN },
    body: photoForm(parts),
  });
  return harness.app.fetch(request, harness.env);
}

export async function galleryToken(harness: PanelHarness): Promise<string> {
  await seedStaff(harness.env, [staffMember(GALLERY_EDITOR, "gallery_editor", true)]);
  return harness.keys.sign(staffClaims(GALLERY_EDITOR));
}

const itemSchema = z.object({ item: panelAlbumSchema });

export async function createAlbum(
  harness: PanelHarness,
  token: string,
  overrides: Partial<AlbumInput> = {},
): Promise<PanelAlbum> {
  const response = await panelJsonCall(harness, "POST", "/albums", {
    token,
    body: albumInput(overrides),
  });
  return itemSchema.parse(await response.json()).item;
}

export async function uploadPhoto(
  harness: PanelHarness,
  albumId: string,
  token: string,
  seed = 1,
): Promise<PanelPhoto> {
  const response = await uploadCall(harness, albumId, token, photoParts(seed));
  return panelPhotoUploadSchema.parse(await response.json()).item;
}

export async function bucketBytes(env: Env, key: string): Promise<Uint8Array | undefined> {
  const stored = await env.MEDIA.get(key);
  return stored === null
    ? undefined
    : new Uint8Array(await new Response(stored.body).arrayBuffer());
}
