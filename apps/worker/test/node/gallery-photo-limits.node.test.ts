import { MAX_ALBUM_PHOTOS, MAX_PHOTO_VARIANT_BYTES } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";

import {
  createAlbum,
  fileOf,
  galleryToken,
  GALLERY_EDITOR,
  photoParts,
  uploadCall,
} from "./gallery-support.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  panelUrl,
  type PanelHarness,
} from "./panel-support.ts";
import { vp8Webp } from "./webp-fixtures.ts";
import { isPhotoUploadPath, MAX_PHOTO_BODY_BYTES } from "../../src/routes/panel/photos.ts";
import { systemClock } from "../../src/storage/database.ts";
import { galleryRepo } from "../../src/storage/gallery-repo.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";

const CONTAINER_BYTES = 30;
const UNKNOWN = "01890a5d-ac96-7abc-8def-0123456789ab";

let harness: PanelHarness;
let token: string;
let albumId: string;

beforeEach(async () => {
  harness = await panelHarness();
  token = await galleryToken(harness);
  albumId = (await createAlbum(harness, token)).id;
});

describe("photo upload limits", () => {
  it("accepts a variant at the size limit and refuses one above it", async ({ expect }) => {
    const filler = (bytes: number): readonly number[] => new Array<number>(bytes).fill(0);
    const atLimit = vp8Webp(1600, 900, filler(MAX_PHOTO_VARIANT_BYTES - CONTAINER_BYTES));
    expect(atLimit.length).toBe(MAX_PHOTO_VARIANT_BYTES);
    const fits = await uploadCall(
      harness,
      albumId,
      token,
      photoParts(1, { large: fileOf(atLimit) }),
    );
    expect(fits.status).toBe(201);
    const smallAtLimit = vp8Webp(400, 225, filler(MAX_PHOTO_VARIANT_BYTES - CONTAINER_BYTES));
    const smallFits = await uploadCall(
      harness,
      albumId,
      token,
      photoParts(2, { small: fileOf(smallAtLimit) }),
    );
    expect(smallFits.status).toBe(201);
    const above = fileOf(vp8Webp(400, 225, filler(MAX_PHOTO_VARIANT_BYTES - CONTAINER_BYTES + 2)));
    await expectProblem(
      await uploadCall(harness, albumId, token, photoParts(1, { small: above })),
      413,
    );
    await expectProblem(
      await uploadCall(harness, albumId, token, photoParts(1, { large: above })),
      413,
    );
  });

  it("limits the whole body, on this route only", async ({ expect }) => {
    const oversized = new Uint8Array(MAX_PHOTO_BODY_BYTES + 1);
    await expectProblem(
      await uploadCall(harness, albumId, token, photoParts(1, { large: fileOf(oversized) })),
      413,
    );
    expect(isPhotoUploadPath(`/api/panel/albums/${UNKNOWN}/photos`)).toBe(true);
    expect(isPhotoUploadPath(`/api/panel/albums/${UNKNOWN}/photos/${UNKNOWN}`)).toBe(false);
    expect(isPhotoUploadPath(`/x/api/panel/albums/${UNKNOWN}/photos`)).toBe(false);
    expect(isPhotoUploadPath("/api/panel/albums//photos")).toBe(false);
    expect(isPhotoUploadPath("/api/panel/albums/a/b/photos")).toBe(false);
    const large = await panelJsonCall(harness, "PATCH", `/albums/${albumId}/photos/${UNKNOWN}`, {
      token,
      body: { alt: "x".repeat(17 * 1024) },
    });
    await expectProblem(large, 413);
  });

  it("refuses another origin and an unknown album", async () => {
    const request = new Request(panelUrl(`/albums/${albumId}/photos`), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin: "https://evil.example" },
    });
    await expectProblem(await harness.app.fetch(request, harness.env), 403);
    await expectProblem(await uploadCall(harness, UNKNOWN, token, photoParts()), 404);
    await expectProblem(await uploadCall(harness, "invalid", token, photoParts()), 422);
  });

  it("refuses a photo above the album limit", async ({ expect }) => {
    const repo = galleryRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom });
    const fakes = [...new Array<number>(MAX_ALBUM_PHOTOS).keys()].map((index) =>
      repo.createPhotoStatement({
        albumId,
        width: 1600,
        height: 900,
        alt: "Zdjęcie",
        sha256: index.toString(16).padStart(64, "0"),
        consentBy: GALLERY_EDITOR,
      }),
    );
    await harness.env.DB.batch(fakes.map((fake) => fake.statement));
    const response = await uploadCall(harness, albumId, token, photoParts());
    expect((await expectProblem(response, 422)).title).toBe("Album Is Full");
  });
});
