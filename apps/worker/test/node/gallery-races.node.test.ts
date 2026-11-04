import { panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";

import { beforeBatch } from "./gallery-race-support.ts";
import {
  bucketBytes,
  createAlbum,
  fileOf,
  galleryToken,
  photoParts,
  uploadCall,
  uploadPhoto,
} from "./gallery-support.ts";
import { expectProblem, panelHarness, panelJsonCall, type PanelHarness } from "./panel-support.ts";
import { vp8Webp } from "./webp-fixtures.ts";

const OTHER_SMALL = vp8Webp(400, 225, [9, 9]);

let harness: PanelHarness;
let token: string;
let albumId: string;

beforeEach(async () => {
  harness = await panelHarness();
  token = await galleryToken(harness);
  albumId = (await createAlbum(harness, token)).id;
});

function duringFirstWrite(during: () => Promise<void>): PanelHarness {
  const { MEDIA } = harness.env;
  let armed = true;
  return {
    ...harness,
    env: {
      ...harness.env,
      MEDIA: {
        get: async (key) => MEDIA.get(key),
        put: async (key, value) => {
          if (armed) {
            armed = false;
            await during();
          }
          return MEDIA.put(key, value);
        },
      },
    },
  };
}

async function publish(target: PanelHarness): Promise<Response> {
  return panelJsonCall(target, "PATCH", `/albums/${albumId}`, {
    token,
    body: { action: "publish" },
  });
}

async function audited(action: string): Promise<unknown> {
  return harness.env.DB.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action = ?")
    .bind(action)
    .first();
}

describe("two uploads of the same large image", () => {
  it("refuses the second while the first runs, so its thumbnail cannot replace the first", async ({
    expect,
  }) => {
    let second: Response | undefined;
    const race = duringFirstWrite(async () => {
      second = await uploadCall(
        harness,
        albumId,
        token,
        photoParts(1, { small: fileOf(OTHER_SMALL) }),
      );
    });
    const first = await uploadCall(race, albumId, token, photoParts());
    expect(first.status).toBe(201);
    if (second === undefined) {
      throw new Error("second upload did not run");
    }
    expect((await expectProblem(second, 409)).title).toBe("Photo Upload In Progress");
    const { item } = panelPhotoUploadSchema.parse(await first.json());
    expect(await bucketBytes(harness.env, photoKey(item.sha256, "s"))).toEqual(vp8Webp(400, 225));
  });

  it("answers duplicate after the first finished and keeps its thumbnail", async ({ expect }) => {
    const first = await uploadPhoto(harness, albumId, token);
    const parts = photoParts(1, { small: fileOf(OTHER_SMALL) });
    const second = await uploadCall(harness, albumId, token, parts);
    expect(second.status).toBe(200);
    expect(panelPhotoUploadSchema.parse(await second.json()).duplicate).toBe(true);
    expect(await bucketBytes(harness.env, photoKey(first.sha256, "s"))).toEqual(vp8Webp(400, 225));
  });

  it("frees the file for a retry once a refused upload ends", async ({ expect }) => {
    const other = await createAlbum(harness, token, { slug: "inny" });
    await uploadPhoto(harness, other.id, token);
    const refused = await uploadCall(harness, albumId, token, photoParts());
    expect((await expectProblem(refused, 409)).title).toBe("Photo In Another Album");
    const again = await uploadCall(harness, albumId, token, photoParts());
    expect((await expectProblem(again, 409)).title).toBe("Photo In Another Album");
  });
});

describe("publishing while the last photo is deleted", () => {
  it("refuses publication when the delete commits first, and audits nothing", async ({
    expect,
  }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    const race = beforeBatch(harness, async () => {
      await panelJsonCall(harness, "DELETE", `/albums/${albumId}/photos/${photo.id}`, {
        token,
        body: {},
      });
    });
    const response = await publish(race);
    expect((await expectProblem(response, 422)).title).toBe("Album Has No Photos");
    expect(await audited("albums.publish")).toEqual({ total: 0 });
  });

  it("unpublishes when the publication commits first", async ({ expect }) => {
    const photo = await uploadPhoto(harness, albumId, token);
    const race = beforeBatch(harness, async () => {
      await publish(harness);
    });
    const response = await panelJsonCall(race, "DELETE", `/albums/${albumId}/photos/${photo.id}`, {
      token,
      body: {},
    });
    expect(response.status).toBe(204);
    const row = await harness.env.DB.prepare("SELECT published_at FROM albums WHERE id = ?")
      .bind(albumId)
      .first();
    expect(row).toEqual({ published_at: null });
  });

  it("still reports a failed publication of an album with photos", async () => {
    await uploadPhoto(harness, albumId, token);
    const race = beforeBatch(harness, async () => {
      await harness.env.DB.prepare("DROP TABLE audit_log").run();
    });
    await expectProblem(await publish(race), 500);
  });
});
