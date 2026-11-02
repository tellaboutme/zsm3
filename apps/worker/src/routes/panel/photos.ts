import {
  MAX_ALBUM_PHOTOS,
  MAX_PHOTO_VARIANT_BYTES,
  panelPhotoUploadSchema,
  photoAltSchema,
  photoKey,
  type PanelAlbum,
  type PanelPhoto,
} from "@zsm3/contracts/gallery";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import { storedAlbum } from "./albums.ts";
import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession } from "./deps.ts";
import { UPLOAD_BODY_OVERHEAD } from "./files.ts";
import { panelGuard, panelJsonOrigin, panelOrigin } from "./guards.ts";
import { parseJsonBody } from "./http.ts";
import { photoSavePlan, PHOTO_ENTITY } from "./photo-save.ts";
import { readPhotoUpload } from "./photo-upload.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { KnownPhoto } from "../../storage/gallery-repo.ts";

export const MAX_PHOTO_BODY_BYTES = 2 * MAX_PHOTO_VARIANT_BYTES + UPLOAD_BODY_OVERHEAD;

const PHOTO_UPLOAD_PATH = /^\/api\/panel\/albums\/[^/]+\/photos$/u;

export function isPhotoUploadPath(path: string): boolean {
  return PHOTO_UPLOAD_PATH.test(path);
}

interface PhotoTarget {
  readonly album: PanelAlbum;
  readonly photo: PanelPhoto;
}

async function storedPhoto(c: Context<AppEnv>): Promise<PhotoTarget | Response> {
  const album = await storedAlbum(c);
  if (album instanceof Response) {
    return album;
  }
  const id = z.uuid().safeParse(c.req.param("photoId"));
  if (!id.success) {
    return problemResponse(c, 422);
  }
  const photo = await requirePanelDeps(c).repos.gallery.photo(album.id, id.data);
  return photo === undefined ? problemResponse(c, 404) : { album, photo };
}

function answerForKnown(
  c: Context<AppEnv>,
  albumId: string,
  known: KnownPhoto | undefined,
): Response | undefined {
  if (known?.live !== true) {
    return undefined;
  }
  return known.photo.albumId === albumId
    ? c.json(panelPhotoUploadSchema.parse({ item: known.photo, duplicate: true }))
    : problemResponse(c, 409, "Photo In Another Album");
}

async function uploadPhoto(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const album = await storedAlbum(c);
  if (album instanceof Response) {
    return album;
  }
  const upload = await readPhotoUpload(c);
  if (upload instanceof Response) {
    return upload;
  }
  const { gallery } = deps.repos;
  const known = await gallery.photoByHash(upload.sha256);
  const answer = answerForKnown(c, album.id, known);
  if (answer !== undefined) {
    return answer;
  }
  if (album.photoCount >= MAX_ALBUM_PHOTOS) {
    return problemResponse(c, 422, "Album Is Full");
  }
  await deps.mediaBucket.put(photoKey(upload.sha256, "l"), upload.large);
  await deps.mediaBucket.put(photoKey(upload.sha256, "s"), upload.small);
  const plan = photoSavePlan({ deps, session, album, upload, known });
  try {
    await atomicWrite(deps, plan.statements);
  } catch (error) {
    const raced = answerForKnown(c, album.id, await gallery.photoByHash(upload.sha256));
    if (raced === undefined) {
      throw error;
    }
    return raced;
  }
  const item = await gallery.savedPhoto(album.id, plan.id);
  return c.json(panelPhotoUploadSchema.parse({ item, duplicate: false }), 201);
}

async function updatePhoto(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const target = await storedPhoto(c);
  if (target instanceof Response) {
    return target;
  }
  const input = await parseJsonBody(c, photoAltSchema);
  if (input === undefined) {
    return problemResponse(c, 422);
  }
  const { album, photo } = target;
  await atomicWrite(deps, [
    deps.repos.gallery.updatePhotoAltStatement(photo.id, input.alt),
    deps.repos.gallery.refreshAlbumStatement(album.id),
    deps.repos.audit.statement(
      auditEntry({
        session: requirePanelSession(c),
        action: "photos.update",
        entity: PHOTO_ENTITY,
        entityId: photo.id,
        fields: changedFields({ alt: photo.alt }, input),
      }),
    ),
  ]);
  const item = await deps.repos.gallery.savedPhoto(album.id, photo.id);
  return c.json({ item });
}

async function deletePhoto(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const target = await storedPhoto(c);
  if (target instanceof Response) {
    return target;
  }
  const { album, photo } = target;
  const emptied = album.publishedAt !== null && album.photoCount === 1;
  await atomicWrite(deps, [
    deps.repos.gallery.deletePhotoStatement(photo.id),
    deps.repos.gallery.refreshAlbumStatement(album.id),
    deps.repos.audit.statement(
      auditEntry({
        session: requirePanelSession(c),
        action: "photos.delete",
        entity: PHOTO_ENTITY,
        entityId: photo.id,
        fields: emptied ? ["deletedAt", "albumPublishedAt"] : ["deletedAt"],
      }),
    ),
  ]);
  return c.body(null, 204);
}

export function photosRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post(
      "/albums/:id/photos",
      panelGuard("photos.upload"),
      panelOrigin,
      bodyLimit({ maxSize: MAX_PHOTO_BODY_BYTES }),
      uploadPhoto,
    )
    .patch("/albums/:id/photos/:photoId", panelGuard("photos.update"), panelJsonOrigin, updatePhoto)
    .delete(
      "/albums/:id/photos/:photoId",
      panelGuard("photos.delete"),
      panelJsonOrigin,
      deletePhoto,
    );
}
