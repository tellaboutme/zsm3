import { MAX_ALBUM_PHOTOS, panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";

import { beforeBatch, fillAlbum, largeHash } from "./gallery-race-support.ts";
import {
  createAlbum,
  galleryToken,
  photoParts,
  uploadCall,
  uploadPhoto,
} from "./gallery-support.ts";
import { expectProblem, panelHarness, panelJsonCall, type PanelHarness } from "./panel-support.ts";

let harness: PanelHarness;
let token: string;
let albumId: string;

beforeEach(async () => {
  harness = await panelHarness();
  token = await galleryToken(harness);
  albumId = (await createAlbum(harness, token)).id;
});

async function audited(action: string): Promise<unknown> {
  return harness.env.DB.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action = ?")
    .bind(action)
    .first();
}

describe("the album limit under parallel uploads", () => {
  it("refuses an upload when others fill the album before it commits", async ({ expect }) => {
    const race = beforeBatch(harness, async () => {
      await fillAlbum(harness, albumId, MAX_ALBUM_PHOTOS);
    });
    const response = await uploadCall(race, albumId, token, photoParts());
    expect((await expectProblem(response, 422)).title).toBe("Album Is Full");
    const row = await harness.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM photos WHERE album_id = ?",
    )
      .bind(albumId)
      .first();
    expect(row).toEqual({ total: MAX_ALBUM_PHOTOS });
    expect(await audited("photos.create")).toEqual({ total: 0 });
  });

  it("refuses a full album before writing to R2, so a retry gets the same answer", async ({
    expect,
  }) => {
    await fillAlbum(harness, albumId, MAX_ALBUM_PHOTOS);
    const parts = photoParts();
    const response = await uploadCall(harness, albumId, token, parts);
    expect((await expectProblem(response, 422)).title).toBe("Album Is Full");
    const stored = await harness.env.MEDIA.get(photoKey(await largeHash(), "l"));
    expect(stored).toBeNull();
    const again = await uploadCall(harness, albumId, token, photoParts());
    expect((await expectProblem(again, 422)).title).toBe("Album Is Full");
  });

  it("still answers duplicate for a photo already in a full album", async ({ expect }) => {
    await uploadPhoto(harness, albumId, token);
    await fillAlbum(harness, albumId, MAX_ALBUM_PHOTOS - 1);
    const response = await uploadCall(harness, albumId, token, photoParts());
    expect(response.status).toBe(200);
    expect(panelPhotoUploadSchema.parse(await response.json()).duplicate).toBe(true);
  });

  it("refuses a restore into a full album at the database", async ({ expect }) => {
    const other = await createAlbum(harness, token, { slug: "inny" });
    const photo = await uploadPhoto(harness, other.id, token);
    await panelJsonCall(harness, "DELETE", `/albums/${other.id}/photos/${photo.id}`, {
      token,
      body: {},
    });
    const race = beforeBatch(harness, async () => {
      await fillAlbum(harness, albumId, MAX_ALBUM_PHOTOS);
    });
    const response = await uploadCall(race, albumId, token, photoParts());
    expect((await expectProblem(response, 422)).title).toBe("Album Is Full");
    const restored = await harness.env.DB.prepare("SELECT deleted_at FROM photos WHERE id = ?")
      .bind(photo.id)
      .first();
    expect(restored).not.toEqual({ deleted_at: null });
  });

  it("allows deleting and restoring within a full album", async ({ expect }) => {
    await fillAlbum(harness, albumId, MAX_ALBUM_PHOTOS);
    const { DB } = harness.env;
    await DB.prepare("UPDATE photos SET deleted_at = 't' WHERE id = 'fake-1'").run();
    await DB.prepare("UPDATE photos SET deleted_at = NULL WHERE id = 'fake-1'").run();
    const row = await DB.prepare("SELECT deleted_at FROM photos WHERE id = 'fake-1'").first();
    expect(row).toEqual({ deleted_at: null });
  });
});
