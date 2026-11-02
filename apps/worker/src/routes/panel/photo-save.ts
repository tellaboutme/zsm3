import type { PanelAlbum } from "@zsm3/contracts/gallery";

import { auditEntry } from "./audit.ts";
import type { PanelDeps, PanelSession } from "./deps.ts";
import type { PhotoUpload } from "./photo-upload.ts";
import type { SqlStatement } from "../../storage/database.ts";
import type { GalleryWrite, KnownPhoto, PhotoWrite } from "../../storage/gallery-repo.ts";

export const PHOTO_ENTITY = "photos";

export interface PhotoSaveInput {
  readonly deps: PanelDeps;
  readonly session: PanelSession;
  readonly album: PanelAlbum;
  readonly upload: PhotoUpload;
  readonly known: KnownPhoto | undefined;
}

export interface PhotoSavePlan {
  readonly id: string;
  readonly statements: readonly SqlStatement[];
}

function photoStatement(
  deps: PanelDeps,
  write: PhotoWrite,
  known: KnownPhoto | undefined,
): GalleryWrite {
  const { gallery } = deps.repos;
  if (known === undefined) {
    return gallery.createPhotoStatement(write);
  }
  const { id } = known.photo;
  return { id, statement: gallery.restorePhotoStatement(id, write) };
}

export function photoSavePlan({
  deps,
  session,
  album,
  upload,
  known,
}: PhotoSaveInput): PhotoSavePlan {
  const { id, statement } = photoStatement(
    deps,
    {
      albumId: album.id,
      width: upload.width,
      height: upload.height,
      alt: upload.alt,
      sha256: upload.sha256,
      consentBy: session.email,
    },
    known,
  );
  return {
    id,
    statements: [
      statement,
      deps.repos.gallery.refreshAlbumStatement(album.id),
      deps.repos.audit.statement(
        auditEntry({
          session,
          action: known === undefined ? "photos.create" : "photos.restore",
          entity: PHOTO_ENTITY,
          entityId: id,
          fields: ["albumId", "alt", "consent"],
        }),
      ),
    ],
  };
}
