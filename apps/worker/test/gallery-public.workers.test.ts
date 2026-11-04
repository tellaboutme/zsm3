import { photoKey } from "@zsm3/contracts/gallery";
import { photoPath } from "@zsm3/contracts/gallery-public";
import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, it } from "vitest";

import { ORIGIN } from "./support.ts";
import { galleryPublicRepo } from "../src/storage/gallery-public-repo.ts";
import { cryptoRandom } from "../src/storage/ids.ts";
import { sitemapRepo } from "../src/storage/sitemap-repo.ts";

const NOW = "2026-10-22T08:00:00.000Z";
const LIVE = "01890a5d-ac96-7abc-8def-000000000001";
const OLDER = "01890a5d-ac96-7abc-8def-000000000002";
const DRAFT = "01890a5d-ac96-7abc-8def-000000000003";
const HASH = "a1".repeat(32);
const SECOND = "a2".repeat(32);
const GONE = "a3".repeat(32);
const OLD_HASH = "a4".repeat(32);
const DRAFT_HASH = "a5".repeat(32);
const store = { db: env.DB, clock: () => new Date(NOW), random: cryptoRandom };

const INSERT_ALBUM = `INSERT INTO albums
  (id, school_year, slug, title, description, created_by, created_at, updated_at)
  VALUES (?1, ?2, ?3, ?4, ?5, 'a@zsm3.test', ?6, ?6)`;
const INSERT_PHOTO = `INSERT INTO photos (id, album_id, position, width, height, alt, sha256,
  consent_by, consent_at, deleted_at, created_by, created_at)
  VALUES (?1, ?2, ?3, 1600, 900, ?4, ?5, 'staff@zsm3.test', ?6, ?7, 'staff@zsm3.test', ?6)`;

async function get(path: string): Promise<Response> {
  return exports.default.fetch(new Request(`${ORIGIN}${path}`));
}

async function insertAlbum(id: string, year: string, slug: string, title: string): Promise<void> {
  await env.DB.prepare(INSERT_ALBUM).bind(id, year, slug, title, "", NOW).run();
}

async function insertPhoto(
  serial: string,
  album: string,
  sha256: string,
  deletedAt: string | null = null,
): Promise<void> {
  const id = `01890a5d-ac96-7abc-8def-1000000000${serial}`;
  await env.DB.prepare(INSERT_PHOTO)
    .bind(id, album, Number(serial), `Zdjęcie ${serial}`, sha256, NOW, deletedAt)
    .run();
  await env.MEDIA.put(photoKey(sha256, "s"), `small ${serial}`);
  await env.MEDIA.put(photoKey(sha256, "l"), `large ${serial}`);
}

async function setPublished(id: string, publishedAt: string | null): Promise<void> {
  await env.DB.prepare("UPDATE albums SET published_at = ? WHERE id = ?")
    .bind(publishedAt, id)
    .run();
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await insertAlbum(LIVE, "2025/2026", "apel", "Apel");
  await insertAlbum(OLDER, "2024/2025", "dawny", "Dawny");
  await insertAlbum(DRAFT, "2025/2026", "szkic", "Szkic");
  await insertPhoto("01", LIVE, HASH);
  await insertPhoto("02", LIVE, SECOND);
  await insertPhoto("03", LIVE, GONE, NOW);
  await insertPhoto("04", OLDER, OLD_HASH);
  await insertPhoto("05", DRAFT, DRAFT_HASH);
  await setPublished(OLDER, NOW);
});

beforeEach(async () => {
  await setPublished(LIVE, NOW);
});

describe("public gallery reads", () => {
  it("lists only years with published albums, newest first, with a short cache", async ({
    expect,
  }) => {
    const response = await get("/api/gallery/years");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({
      items: [
        { schoolYear: "2025/2026", albumCount: 1 },
        { schoolYear: "2024/2025", albumCount: 1 },
      ],
    });
  });

  it("lists a year's published albums with live counts and the first live photo", async ({
    expect,
  }) => {
    const response = await get("/api/gallery/years/2025-2026/albums");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({
      items: [
        {
          id: LIVE,
          schoolYear: "2025/2026",
          slug: "apel",
          title: "Apel",
          description: "",
          photoCount: 2,
          coverSha256: HASH,
        },
      ],
    });
  });

  it("returns an empty list for a real year without albums and 404 for a false one", async ({
    expect,
  }) => {
    expect(await (await get("/api/gallery/years/2019-2020/albums")).json()).toEqual({ items: [] });
    for (const year of ["2019-2021", "2019", "..%2F..", "2019%2F2020"]) {
      const response = await get(`/api/gallery/years/${year}/albums`);
      expect(response.status, year).toBe(404);
      expect(response.headers.get("Cache-Control"), year).toBe("no-store");
    }
  });

  it("shows live photos of a published album without any staff details", async ({ expect }) => {
    const response = await get(`/api/gallery/albums/${LIVE}`);
    const text = await response.text();
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(JSON.parse(text)).toMatchObject({
      item: { id: LIVE, photoCount: 2 },
      photos: [{ sha256: HASH }, { sha256: SECOND }],
    });
    expect(text).not.toContain("staff@zsm3.test");
    expect(text).not.toContain(GONE);
  });

  it("answers 404 for a draft, a malformed id and an unknown album", async ({ expect }) => {
    for (const id of [DRAFT, "nie-uuid", "01890a5d-ac96-7abc-8def-0000000000ff"]) {
      const response = await get(`/api/gallery/albums/${id}`);
      expect(response.status, id).toBe(404);
      expect(response.headers.get("Cache-Control"), id).toBe("no-store");
    }
  });
});

describe("public gallery album addresses", () => {
  it("finds a published album by year and slug, and never a draft", async ({ expect }) => {
    const repo = galleryPublicRepo(store);
    expect((await repo.albumBySlug("2025/2026", "apel"))?.item.id).toBe(LIVE);
    expect(await repo.albumBySlug("2025/2026", "szkic")).toBeUndefined();
    expect(await repo.albumBySlug("2024/2025", "apel")).toBeUndefined();
  });
});

describe("public gallery photos", () => {
  it("serves a published photo with its type, a short cache and no sniffing", async ({
    expect,
  }) => {
    const response = await get(photoPath(HASH, "s"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("small 01");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Content-Length")).toBe("8");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("ETag")).toBe(`"${HASH}-s.webp"`);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("serves the edge copy once R2 has been read", async ({ expect }) => {
    await (await get(photoPath(SECOND, "l"))).arrayBuffer();
    await env.MEDIA.delete(photoKey(SECOND, "l"));
    const response = await get(photoPath(SECOND, "l"));
    expect(await response.text()).toBe("large 02");
    await env.MEDIA.put(photoKey(SECOND, "l"), "large 02");
  });

  it("stops an edge copy the moment the album is unpublished", async ({ expect }) => {
    await (await get(photoPath(HASH, "l"))).arrayBuffer();
    await setPublished(LIVE, null);
    const response = await get(photoPath(HASH, "l"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refuses draft, deleted, unknown and malformed photos even when R2 holds them", async ({
    expect,
  }) => {
    await env.MEDIA.put("g/evil.webp", "x");
    for (const path of [
      photoPath(DRAFT_HASH, "s"),
      photoPath(GONE, "s"),
      photoPath("ff".repeat(32), "s"),
      "/media/g/evil.webp",
      `/media/g/${HASH}-x.webp`,
      `/media/g/..%2F${HASH}-s.webp`,
    ]) {
      const response = await get(path);
      expect(response.status, path).toBe(404);
      expect(response.headers.get("Content-Type"), path).toBe("application/problem+json");
    }
  });

  it("answers 404 when a published photo has lost its file", async ({ expect }) => {
    await env.MEDIA.delete(photoKey(OLD_HASH, "s"));
    expect((await get(photoPath(OLD_HASH, "s"))).status).toBe(404);
  });
});

describe("gallery sitemap entries", () => {
  it("lists the gallery, each year and each published album once", async ({ expect }) => {
    const entries = await sitemapRepo(store).published();
    const paths = entries.map((entry) => entry.path).filter((path) => path.includes("galeria"));
    expect(paths.toSorted()).toEqual([
      "/szkola/galeria",
      "/szkola/galeria/2024-2025",
      "/szkola/galeria/2024-2025/dawny",
      "/szkola/galeria/2025-2026",
      "/szkola/galeria/2025-2026/apel",
    ]);
  });
});
