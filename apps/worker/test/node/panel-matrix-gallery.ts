import type { PanelRouteName } from "@zsm3/contracts/panel";

import { albumInput, photoParts, uploadCall } from "./gallery-support.ts";
import { panelJsonCall, type PanelHarness } from "./panel-support.ts";
import type { Store } from "../../src/storage/database.ts";
import { galleryRepo } from "../../src/storage/gallery-repo.ts";

interface RouteCase {
  readonly name: PanelRouteName;
  readonly call: (token: string) => Promise<Response>;
}

interface RoleFixture {
  readonly albumId: string;
  readonly photoId: string;
  readonly seed: number;
}

export const GALLERY_STATUSES = {
  "albums.list": 200,
  "albums.get": 200,
  "albums.create": 201,
  "albums.update": 200,
  "albums.publish": 200,
  "albums.delete": 204,
  "photos.upload": 201,
  "photos.update": 200,
  "photos.delete": 204,
} as const;

const fixtures = new Map<string, RoleFixture>();
const CREATOR = "admin@zsm3.test";
const ROLE_SEED_BASE = 100;

function fixture(key: string | undefined): RoleFixture {
  const found = key === undefined ? undefined : fixtures.get(key);
  if (found === undefined) {
    throw new Error("fixture");
  }
  return found;
}

export async function seedGalleryMatrix(store: Store, roles: readonly string[]): Promise<void> {
  const repo = galleryRepo(store);
  for (const [index, key] of [...roles, "shared"].entries()) {
    const album = repo.createAlbumStatement(
      albumInput({ slug: `album-${String(index)}` }),
      CREATOR,
    );
    const photo = repo.createPhotoStatement({
      albumId: album.id,
      width: 1600,
      height: 900,
      alt: "Zdjęcie",
      sha256: index.toString(16).padStart(64, "0"),
      consentBy: CREATOR,
    });
    await store.db.batch([album.statement, photo.statement]);
    fixtures.set(key, {
      albumId: album.id,
      photoId: photo.id,
      seed: ROLE_SEED_BASE + index,
    });
  }
}

export function galleryCases(
  harness: PanelHarness,
  rolesByToken: ReadonlyMap<string, string>,
): readonly RouteCase[] {
  const own = (token: string): RoleFixture => fixture(rolesByToken.get(token));
  const shared = (): RoleFixture => fixture("shared");
  return [
    {
      name: "albums.list",
      call: async (token) => panelJsonCall(harness, "GET", "/albums", { token }),
    },
    {
      name: "albums.get",
      call: async (token) =>
        panelJsonCall(harness, "GET", `/albums/${shared().albumId}`, { token }),
    },
    {
      name: "albums.create",
      call: async (token) =>
        panelJsonCall(harness, "POST", "/albums", {
          token,
          body: albumInput({ slug: `nowy-${String(own(token).seed)}` }),
        }),
    },
    {
      name: "albums.update",
      call: async (token) =>
        panelJsonCall(harness, "PUT", `/albums/${shared().albumId}`, {
          token,
          body: albumInput({ slug: "wspolny" }),
        }),
    },
    {
      name: "albums.publish",
      call: async (token) =>
        panelJsonCall(harness, "PATCH", `/albums/${own(token).albumId}`, {
          token,
          body: { action: "publish" },
        }),
    },
    {
      name: "photos.upload",
      call: async (token) =>
        uploadCall(harness, shared().albumId, token, photoParts(own(token).seed)),
    },
    {
      name: "photos.update",
      call: async (token) =>
        panelJsonCall(harness, "PATCH", `/albums/${shared().albumId}/photos/${shared().photoId}`, {
          token,
          body: { alt: "Nowy opis" },
        }),
    },
    {
      name: "photos.delete",
      call: async (token) =>
        panelJsonCall(
          harness,
          "DELETE",
          `/albums/${own(token).albumId}/photos/${own(token).photoId}`,
          { token, body: {} },
        ),
    },
    {
      name: "albums.delete",
      call: async (token) =>
        panelJsonCall(harness, "DELETE", `/albums/${own(token).albumId}`, { token, body: {} }),
    },
  ];
}
