import {
  albumInputSchema,
  albumPublicationSchema,
  panelAlbumListQuerySchema,
  panelAlbumListSchema,
  panelAlbumViewSchema,
  type AlbumInput,
  type PanelAlbum,
} from "@zsm3/contracts/gallery";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { atomicWrite } from "./atomic.ts";
import { auditEntry, changedFields, createdFields } from "./audit.ts";
import { requirePanelDeps, requirePanelSession, type PanelDeps } from "./deps.ts";
import { panelGuard, panelJsonOrigin } from "./guards.ts";
import { parseJsonBody, uniqueQuery } from "./http.ts";
import type { AppEnv } from "../../app-env.ts";
import { problemResponse } from "../../http/problem.ts";
import type { SqlStatement } from "../../storage/database.ts";

const ENTITY = "albums";
const SLUG_TAKEN = "Album Slug Taken";

export async function storedAlbum(c: Context<AppEnv>): Promise<PanelAlbum | Response> {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) {
    return problemResponse(c, 422);
  }
  const item = await requirePanelDeps(c).repos.gallery.album(id.data);
  return item ?? problemResponse(c, 404);
}

function editable(item: PanelAlbum): AlbumInput {
  return {
    schoolYear: item.schoolYear,
    slug: item.slug,
    title: item.title,
    description: item.description,
  };
}

async function slugTaken(deps: PanelDeps, input: AlbumInput, ownId: string): Promise<boolean> {
  const id = await deps.repos.gallery.albumIdBySlug(input.schoolYear, input.slug);
  return id !== undefined && id !== ownId;
}

async function writeAlbum(
  c: Context<AppEnv>,
  input: AlbumInput,
  ownId: string,
  statements: readonly SqlStatement[],
): Promise<Response | undefined> {
  const deps = requirePanelDeps(c);
  try {
    await atomicWrite(deps, statements);
    return undefined;
  } catch (error) {
    if (await slugTaken(deps, input, ownId)) {
      return problemResponse(c, 409, SLUG_TAKEN);
    }
    throw error;
  }
}

async function listAlbums(c: Context<AppEnv>): Promise<Response> {
  const query = panelAlbumListQuerySchema.safeParse(uniqueQuery(c));
  if (!query.success) {
    return problemResponse(c, 422);
  }
  const items = await requirePanelDeps(c).repos.gallery.albums(query.data.schoolYear);
  return c.json(panelAlbumListSchema.parse({ items }));
}

async function getAlbum(c: Context<AppEnv>): Promise<Response> {
  const item = await storedAlbum(c);
  if (item instanceof Response) {
    return item;
  }
  const photos = await requirePanelDeps(c).repos.gallery.photos(item.id);
  return c.json(panelAlbumViewSchema.parse({ item, photos }));
}

async function createAlbum(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const input = await parseJsonBody(c, albumInputSchema);
  if (input === undefined) {
    return problemResponse(c, 422);
  }
  const write = deps.repos.gallery.createAlbumStatement(input, session.email);
  const refused = await writeAlbum(c, input, write.id, [
    write.statement,
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "albums.create",
        entity: ENTITY,
        entityId: write.id,
        fields: createdFields(input),
      }),
    ),
  ]);
  return refused ?? c.json({ item: await deps.repos.gallery.savedAlbum(write.id) }, 201);
}

async function updateAlbum(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const previous = await storedAlbum(c);
  if (previous instanceof Response) {
    return previous;
  }
  const input = await parseJsonBody(c, albumInputSchema);
  if (input === undefined) {
    return problemResponse(c, 422);
  }
  const refused = await writeAlbum(c, input, previous.id, [
    deps.repos.gallery.updateAlbumStatement(previous.id, input),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "albums.update",
        entity: ENTITY,
        entityId: previous.id,
        fields: changedFields(editable(previous), input),
      }),
    ),
  ]);
  return refused ?? c.json({ item: await deps.repos.gallery.savedAlbum(previous.id) });
}

async function publishAlbum(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const previous = await storedAlbum(c);
  if (previous instanceof Response) {
    return previous;
  }
  const change = await parseJsonBody(c, albumPublicationSchema);
  if (change === undefined) {
    return problemResponse(c, 422);
  }
  const publishing = change.action === "publish";
  if (publishing === (previous.publishedAt !== null)) {
    return problemResponse(c, 422, "Publication Status Unchanged");
  }
  if (publishing && previous.photoCount === 0) {
    return problemResponse(c, 422, "Album Has No Photos");
  }
  await atomicWrite(deps, [
    deps.repos.gallery.publicationStatement(previous.id, publishing),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: `albums.${change.action}`,
        entity: ENTITY,
        entityId: previous.id,
        fields: ["publishedAt"],
      }),
    ),
  ]);
  return c.json({ item: await deps.repos.gallery.savedAlbum(previous.id) });
}

async function deleteAlbum(c: Context<AppEnv>): Promise<Response> {
  const deps = requirePanelDeps(c);
  const session = requirePanelSession(c);
  const previous = await storedAlbum(c);
  if (previous instanceof Response) {
    return previous;
  }
  await atomicWrite(deps, [
    deps.repos.gallery.deleteAlbumStatement(previous.id),
    deps.repos.audit.statement(
      auditEntry({
        session,
        action: "albums.delete",
        entity: ENTITY,
        entityId: previous.id,
        fields: ["deletedAt"],
      }),
    ),
  ]);
  return c.body(null, 204);
}

export function albumsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get("/albums", panelGuard("albums.list"), listAlbums)
    .post("/albums", panelGuard("albums.create"), panelJsonOrigin, createAlbum)
    .get("/albums/:id", panelGuard("albums.get"), getAlbum)
    .put("/albums/:id", panelGuard("albums.update"), panelJsonOrigin, updateAlbum)
    .patch("/albums/:id", panelGuard("albums.publish"), panelJsonOrigin, publishAlbum)
    .delete("/albums/:id", panelGuard("albums.delete"), panelJsonOrigin, deleteAlbum);
}
