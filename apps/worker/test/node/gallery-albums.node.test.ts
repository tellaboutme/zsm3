import {
  panelAlbumListSchema,
  panelAlbumSchema,
  panelAlbumViewSchema,
} from "@zsm3/contracts/gallery";
import { beforeEach, describe, it } from "vitest";
import { z } from "zod";

import {
  albumInput,
  createAlbum,
  galleryToken,
  GALLERY_EDITOR,
  uploadPhoto,
} from "./gallery-support.ts";
import {
  expectProblem,
  panelAudit,
  panelHarness,
  panelJsonCall,
  type PanelHarness,
} from "./panel-support.ts";

const UNKNOWN = "01890a5d-ac96-7abc-8def-0123456789ab";
const itemSchema = z.object({ item: panelAlbumSchema });

let harness: PanelHarness;
let token: string;

beforeEach(async () => {
  harness = await panelHarness();
  token = await galleryToken(harness);
});

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  return panelJsonCall(harness, method, path, { token, ...(body === undefined ? {} : { body }) });
}

async function listed(query = ""): Promise<readonly string[]> {
  const response = await send("GET", `/albums${query}`);
  return panelAlbumListSchema.parse(await response.json()).items.map((item) => item.slug);
}

describe("album lifecycle", () => {
  it("creates a hidden album and audits only field names", async ({ expect }) => {
    const response = await send("POST", "/albums", albumInput());
    expect(response.status).toBe(201);
    const { item } = itemSchema.parse(await response.json());
    expect(item).toMatchObject({ ...albumInput(), publishedAt: null, photoCount: 0 });
    const audit = await panelAudit(harness.env).list(10);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorEmail: GALLERY_EDITOR,
      action: "albums.create",
      entity: "albums",
      entityId: item.id,
      details: JSON.stringify({ fields: ["schoolYear", "slug", "title", "description"] }),
    });
  });

  it("updates an album and audits the changed fields", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    const response = await send("PUT", `/albums/${album.id}`, albumInput({ title: "Nowy tytuł" }));
    expect(response.status).toBe(200);
    expect(itemSchema.parse(await response.json()).item.title).toBe("Nowy tytuł");
    const audit = await panelAudit(harness.env).list(10);
    expect(audit.map((entry) => entry.details)).toContain(JSON.stringify({ fields: ["title"] }));
  });

  it("returns an album with its photos in order", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    await uploadPhoto(harness, album.id, token, 1);
    await uploadPhoto(harness, album.id, token, 2);
    const response = await send("GET", `/albums/${album.id}`);
    const view = panelAlbumViewSchema.parse(await response.json());
    expect(view.item.photoCount).toBe(2);
    expect(view.photos.map((photo) => photo.position)).toEqual([0, 1]);
  });

  it("lists albums newest year first and filters by year", async ({ expect }) => {
    await createAlbum(harness, token, { schoolYear: "2024/2025", slug: "stary" });
    await createAlbum(harness, token, { schoolYear: "2026/2027", slug: "nowy" });
    expect(await listed()).toEqual(["nowy", "stary"]);
    expect(await listed("?schoolYear=2024/2025")).toEqual(["stary"]);
  });

  it("refuses unknown or repeated list filters", async () => {
    await expectProblem(await send("GET", "/albums?schoolYear=2024"), 422);
    await expectProblem(await send("GET", "/albums?extra=1"), 422);
    await expectProblem(
      await send("GET", "/albums?schoolYear=2024/2025&schoolYear=2025/2026"),
      422,
    );
  });

  it("hides a deleted album everywhere", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    const response = await send("DELETE", `/albums/${album.id}`, {});
    expect(response.status).toBe(204);
    expect(await listed()).toEqual([]);
    await expectProblem(await send("GET", `/albums/${album.id}`), 404);
    await expectProblem(await send("DELETE", `/albums/${album.id}`, {}), 404);
    const audit = await panelAudit(harness.env).list(10);
    expect(audit.find((entry) => entry.action === "albums.delete")?.details).toBe(
      JSON.stringify({ fields: ["deletedAt"] }),
    );
  });

  it("clears publication when a published album is deleted", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    await uploadPhoto(harness, album.id, token);
    await send("PATCH", `/albums/${album.id}`, { action: "publish" });
    await send("DELETE", `/albums/${album.id}`, {});
    const row = await harness.env.DB.prepare(
      "SELECT published_at, deleted_at FROM albums WHERE id = ?",
    )
      .bind(album.id)
      .first();
    const stored = z.object({ published_at: z.null(), deleted_at: z.string() }).parse(row);
    expect(stored.deleted_at.length).toBeGreaterThan(0);
  });
});

describe("album slugs", () => {
  it("refuses a slug already used in the same year", async ({ expect }) => {
    await createAlbum(harness, token);
    const problem = await expectProblem(await send("POST", "/albums", albumInput()), 409);
    expect(problem.title).toBe("Album Slug Taken");
  });

  it("allows the same slug in another year and after deletion", async ({ expect }) => {
    const first = await createAlbum(harness, token);
    const other = await send("POST", "/albums", albumInput({ schoolYear: "2025/2026" }));
    expect(other.status).toBe(201);
    await send("DELETE", `/albums/${first.id}`, {});
    expect((await send("POST", "/albums", albumInput())).status).toBe(201);
  });

  it("lets an album keep its slug but not take another's", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    await createAlbum(harness, token, { slug: "inny" });
    expect((await send("PUT", `/albums/${album.id}`, albumInput())).status).toBe(200);
    const taken = await send("PUT", `/albums/${album.id}`, albumInput({ slug: "inny" }));
    expect((await expectProblem(taken, 409)).title).toBe("Album Slug Taken");
  });
});

describe("album publication", () => {
  it("publishes only an album with photos, and only once", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    const path = `/albums/${album.id}`;
    const empty = await send("PATCH", path, { action: "publish" });
    expect((await expectProblem(empty, 422)).title).toBe("Album Has No Photos");
    await uploadPhoto(harness, album.id, token);
    const published = await send("PATCH", path, { action: "publish" });
    expect(published.status).toBe(200);
    expect(itemSchema.parse(await published.json()).item.publishedAt).not.toBeNull();
    const again = await send("PATCH", path, { action: "publish" });
    expect((await expectProblem(again, 422)).title).toBe("Publication Status Unchanged");
  });

  it("unpublishes a published album, and only once", async ({ expect }) => {
    const album = await createAlbum(harness, token);
    const path = `/albums/${album.id}`;
    const hidden = await send("PATCH", path, { action: "unpublish" });
    expect((await expectProblem(hidden, 422)).title).toBe("Publication Status Unchanged");
    await uploadPhoto(harness, album.id, token);
    await send("PATCH", path, { action: "publish" });
    const response = await send("PATCH", path, { action: "unpublish" });
    expect(itemSchema.parse(await response.json()).item.publishedAt).toBeNull();
    const audit = await panelAudit(harness.env).list(10);
    for (const action of ["albums.publish", "albums.unpublish"]) {
      expect(audit.find((entry) => entry.action === action)?.details).toBe(
        JSON.stringify({ fields: ["publishedAt"] }),
      );
    }
  });
});

describe("invalid album requests", () => {
  it("refuses malformed ids and bodies", async () => {
    const album = await createAlbum(harness, token);
    await expectProblem(await send("GET", "/albums/invalid"), 422);
    await expectProblem(await send("POST", "/albums", { slug: "x" }), 422);
    await expectProblem(await send("PUT", `/albums/${album.id}`, { slug: "x" }), 422);
    await expectProblem(await send("PATCH", `/albums/${album.id}`, { action: "hide" }), 422);
  });

  it("answers 404 for an unknown album on every route", async () => {
    const path = `/albums/${UNKNOWN}`;
    await expectProblem(await send("GET", path), 404);
    await expectProblem(await send("PUT", path, albumInput()), 404);
    await expectProblem(await send("PATCH", path, { action: "publish" }), 404);
    await expectProblem(await send("DELETE", path, {}), 404);
  });

  it("refuses a write from another origin", async () => {
    const request = new Request("https://panel.zsm3.test/api/panel/albums", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(albumInput()),
    });
    await expectProblem(await harness.app.fetch(request, harness.env), 403);
  });
});
