import { beforeEach, describe, it } from "vitest";

import {
  DRAFT,
  galleryFixture,
  GONE,
  HASH,
  LIVE,
  SECOND,
  type GalleryFixture,
} from "./gallery-public-support.ts";
import { counterRandom, FIXED_CLOCK } from "./memory-database.ts";
import { galleryPublicRepo } from "../../src/storage/gallery-public-repo.ts";

const YEARLESS = "2019-2020";

let fixture: GalleryFixture;

beforeEach(async () => {
  fixture = await galleryFixture();
});

describe("public gallery reads", () => {
  it("lists only years with published albums, newest first", async ({ expect }) => {
    const response = await fixture.get("/api/gallery/years");
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
    const response = await fixture.get("/api/gallery/years/2025-2026/albums");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({
      items: [
        {
          id: LIVE,
          schoolYear: "2025/2026",
          slug: "apel",
          title: "apel",
          description: "",
          photoCount: 2,
          coverSha256: HASH,
        },
      ],
    });
  });

  it("orders a year's albums by publication, newest first", async ({ expect }) => {
    await fixture.setPublished(DRAFT, "2026-10-23T08:00:00.000Z");
    const body: unknown = await (await fixture.get("/api/gallery/years/2025-2026/albums")).json();
    expect(body).toMatchObject({ items: [{ id: DRAFT }, { id: LIVE }] });
  });

  it("gives an empty list for a real year and 404 for a false one", async ({ expect }) => {
    expect(await (await fixture.get(`/api/gallery/years/${YEARLESS}/albums`)).json()).toEqual({
      items: [],
    });
    const response = await fixture.get("/api/gallery/years/2019-2021/albums");
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("shows live photos of a published album without staff details", async ({ expect }) => {
    const response = await fixture.get(`/api/gallery/albums/${LIVE}`);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(JSON.parse(text)).toMatchObject({
      item: { id: LIVE, photoCount: 2 },
      photos: [
        { sha256: HASH, width: 1600, height: 900, alt: "Zdjęcie 01" },
        { sha256: SECOND, alt: "Zdjęcie 02" },
      ],
    });
    expect(text).not.toContain("staff@zsm3.test");
    expect(text).not.toContain(GONE);
  });

  it("answers 404 for a draft, a malformed id and an unknown album", async ({ expect }) => {
    for (const id of [DRAFT, "nie-uuid", "01890a5d-ac96-7abc-8def-0000000000ff"]) {
      expect((await fixture.get(`/api/gallery/albums/${id}`)).status, id).toBe(404);
    }
  });

  it("finds a published album by year and slug, and never a draft", async ({ expect }) => {
    const repo = galleryPublicRepo({ db: fixture.DB, clock: FIXED_CLOCK, random: counterRandom() });
    expect((await repo.albumBySlug("2025/2026", "apel"))?.item.id).toBe(LIVE);
    expect(await repo.albumBySlug("2025/2026", "szkic")).toBeUndefined();
    expect(await repo.albumBySlug("2024/2025", "apel")).toBeUndefined();
  });
});
