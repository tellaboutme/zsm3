import { photoKey } from "@zsm3/contracts/gallery";
import { photoPath } from "@zsm3/contracts/gallery-public";
import { beforeEach, describe, it } from "vitest";

import {
  DRAFT_HASH,
  galleryFixture,
  GONE,
  HASH,
  LIVE,
  NOW,
  OLD_HASH,
  type GalleryFixture,
} from "./gallery-public-support.ts";
import { counterRandom, FIXED_CLOCK } from "./memory-database.ts";
import { sitemapRepo } from "../../src/storage/sitemap-repo.ts";

let fixture: GalleryFixture;

beforeEach(async () => {
  fixture = await galleryFixture();
});

describe("public gallery photos", () => {
  it("serves a published photo with its type and never lets it be stored", async ({ expect }) => {
    const response = await fixture.get(photoPath(HASH, "s"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Length")).toBe("8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("small 01");
  });

  it("stops delivery at the next request after the album is unpublished", async ({ expect }) => {
    expect((await fixture.get(photoPath(HASH, "l"))).status).toBe(200);
    await fixture.setPublished(LIVE, null);
    const response = await fixture.get(photoPath(HASH, "l"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("stops delivery at the next request after the photo is deleted", async ({ expect }) => {
    expect((await fixture.get(photoPath(HASH, "l"))).status).toBe(200);
    await fixture.DB.prepare("UPDATE photos SET deleted_at = ? WHERE sha256 = ?")
      .bind(NOW, HASH)
      .run();
    expect((await fixture.get(photoPath(HASH, "l"))).status).toBe(404);
  });

  it("refuses draft, deleted, unknown and malformed photos even when R2 holds them", async ({
    expect,
  }) => {
    fixture.files.set("g/evil.webp", "x");
    for (const path of [
      photoPath(DRAFT_HASH, "s"),
      photoPath(GONE, "s"),
      photoPath("ff".repeat(32), "s"),
      "/media/g/evil.webp",
      `/media/g/${HASH}-x.webp`,
    ]) {
      expect((await fixture.get(path)).status, path).toBe(404);
    }
  });

  it("answers 404 when a published photo has lost its file", async ({ expect }) => {
    fixture.files.delete(photoKey(OLD_HASH, "s"));
    expect((await fixture.get(photoPath(OLD_HASH, "s"))).status).toBe(404);
  });
});

describe("gallery sitemap entries", () => {
  it("lists each path once with the newest album's date", async ({ expect }) => {
    const later = "2026-10-23T08:00:00.000Z";
    await fixture.DB.prepare("UPDATE albums SET updated_at = ? WHERE id = ?")
      .bind(later, LIVE)
      .run();
    const repo = sitemapRepo({ db: fixture.DB, clock: FIXED_CLOCK, random: counterRandom() });
    const entries = (await repo.published()).filter((entry) => entry.path.includes("galeria"));
    expect(entries).toEqual([
      { path: "/szkola/galeria", lastmod: later },
      { path: "/szkola/galeria/2025-2026", lastmod: later },
      { path: "/szkola/galeria/2025-2026/apel", lastmod: later },
      { path: "/szkola/galeria/2024-2025", lastmod: NOW },
      { path: "/szkola/galeria/2024-2025/dawny", lastmod: NOW },
    ]);
  });
});
