import { panelPhotoUploadSchema, photoKey } from "@zsm3/contracts/gallery";
import { describe, it } from "vitest";

import {
  albumInput,
  bucketBytes,
  createAlbum,
  galleryToken,
  photoParts,
  uploadCall,
  uploadPhoto,
} from "./gallery-support.ts";
import { panelSpyHarness, spyToken, SPY_ADMIN, spyTotal } from "./panel-spy.ts";
import {
  expectProblem,
  panelHarness,
  panelJsonCall,
  seedStaff,
  type PanelHarness,
} from "./panel-support.ts";
import { vp8Webp } from "./webp-fixtures.ts";
import type { SqlDatabase } from "../../src/storage/database.ts";

const JOURNAL_TOTAL = "SELECT COUNT(*) AS total FROM photo_uploads";

const LARGE_HASH = async (): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(vp8Webp(1600, 900, [1, 0])));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

function racing(harness: PanelHarness, before: () => Promise<void>): PanelHarness {
  const { DB } = harness.env;
  let armed = true;
  const db: SqlDatabase = {
    prepare: (query) => DB.prepare(query),
    batch: async (statements) => {
      if (armed) {
        armed = false;
        await before();
      }
      return DB.batch(statements);
    },
  };
  return { ...harness, env: { ...harness.env, DB: db } };
}

describe("concurrent writes", () => {
  it("answers duplicate when the same album won the race", async ({ expect }) => {
    const harness = await panelHarness();
    const token = await galleryToken(harness);
    const album = await createAlbum(harness, token);
    const race = racing(harness, async () => {
      await uploadPhoto(harness, album.id, token);
    });
    const response = await uploadCall(race, album.id, token, photoParts());
    expect(response.status).toBe(200);
    const body = panelPhotoUploadSchema.parse(await response.json());
    expect(body.duplicate).toBe(true);
    expect(body.item.sha256).toBe(await LARGE_HASH());
  });

  it("answers 409 when another album won the race", async ({ expect }) => {
    const harness = await panelHarness();
    const token = await galleryToken(harness);
    const album = await createAlbum(harness, token);
    const other = await createAlbum(harness, token, { slug: "inny" });
    const race = racing(harness, async () => {
      await uploadPhoto(harness, other.id, token);
    });
    const response = await uploadCall(race, album.id, token, photoParts());
    expect((await expectProblem(response, 409)).title).toBe("Photo In Another Album");
  });

  it("answers 409 when another request took the slug first", async ({ expect }) => {
    const harness = await panelHarness();
    const token = await galleryToken(harness);
    const race = racing(harness, async () => {
      await createAlbum(harness, token);
    });
    const response = await panelJsonCall(race, "POST", "/albums", { token, body: albumInput() });
    expect((await expectProblem(response, 409)).title).toBe("Album Slug Taken");
  });
});

describe("failed writes", () => {
  it("writes no album when the audit insert fails", async ({ expect }) => {
    const spy = await panelSpyHarness();
    await seedStaff({ ...spy.env, DB: spy.memory }, [SPY_ADMIN]);
    const token = await spyToken(spy);
    spy.failAudit();
    const response = await panelJsonCall(spy, "POST", "/albums", { token, body: albumInput() });
    await expectProblem(response, 500);
    expect(spyTotal(spy, "SELECT COUNT(*) AS total FROM albums")).toEqual({ total: 0 });
  });

  it("does not call an album's own slug taken when a save fails", async () => {
    const spy = await panelSpyHarness();
    await seedStaff({ ...spy.env, DB: spy.memory }, [SPY_ADMIN]);
    const token = await spyToken(spy);
    const album = await createAlbum(spy, token);
    spy.failAudit();
    const response = await panelJsonCall(spy, "PUT", `/albums/${album.id}`, {
      token,
      body: albumInput(),
    });
    await expectProblem(response, 500);
  });

  it("writes no photo row when the audit insert fails, leaving unreachable objects", async ({
    expect,
  }) => {
    const spy = await panelSpyHarness();
    await seedStaff({ ...spy.env, DB: spy.memory }, [SPY_ADMIN]);
    const token = await spyToken(spy);
    const album = await createAlbum(spy, token);
    spy.failAudit();
    const response = await uploadCall(spy, album.id, token, photoParts());
    await expectProblem(response, 500);
    expect(spyTotal(spy, "SELECT COUNT(*) AS total FROM photos")).toEqual({ total: 0 });
    expect(await bucketBytes(spy.env, photoKey(await LARGE_HASH(), "l"))).toBeDefined();
    expect(spyTotal(spy, JOURNAL_TOTAL)).toEqual({ total: 1 });
  });

  it("clears the journal row when the save succeeds", async ({ expect }) => {
    const spy = await panelSpyHarness();
    await seedStaff({ ...spy.env, DB: spy.memory }, [SPY_ADMIN]);
    const token = await spyToken(spy);
    const album = await createAlbum(spy, token);
    await uploadPhoto(spy, album.id, token);
    expect(spyTotal(spy, JOURNAL_TOTAL)).toEqual({ total: 0 });
  });

  it("refuses an upload while cleanup is removing the same files", async ({ expect }) => {
    const spy = await panelSpyHarness();
    await seedStaff({ ...spy.env, DB: spy.memory }, [SPY_ADMIN]);
    const token = await spyToken(spy);
    const album = await createAlbum(spy, token);
    spy.memory.sqlite
      .prepare("INSERT INTO photo_uploads (sha256, started_at, claimed_at) VALUES (?, 't', 't')")
      .run(await LARGE_HASH());
    const response = await uploadCall(spy, album.id, token, photoParts());
    expect((await expectProblem(response, 409)).title).toBe("Photo Cleanup Running");
    expect(await bucketBytes(spy.env, photoKey(await LARGE_HASH(), "l"))).toBeUndefined();
  });

  it("stores no variant when the upload is refused", async ({ expect }) => {
    const harness = await panelHarness();
    const token = await galleryToken(harness);
    const album = await createAlbum(harness, token);
    const refused = photoParts(1, { consent: "false" });
    await expectProblem(await uploadCall(harness, album.id, token, refused), 422);
    expect(await bucketBytes(harness.env, photoKey(await LARGE_HASH(), "l"))).toBeUndefined();
    expect(await bucketBytes(harness.env, photoKey(await LARGE_HASH(), "s"))).toBeUndefined();
  });
});
