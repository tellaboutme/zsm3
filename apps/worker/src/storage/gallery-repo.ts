import {
  albumInputSchema,
  MAX_ALBUM_PHOTOS,
  MAX_LISTED_ALBUMS,
  type AlbumInput,
  type PanelAlbum,
  type PanelPhoto,
} from "@zsm3/contracts/gallery";

import { allRows, firstRow, timestamp, type SqlStatement, type Store } from "./database.ts";
import {
  albumFromRow,
  albumIdRowSchema,
  albumRowSchema,
  knownRowSchema,
  photoFromRow,
  photoRowSchema,
} from "./gallery-rows.ts";
import {
  DELETE_ALBUM,
  DELETE_PHOTO,
  INSERT_ALBUM,
  INSERT_PHOTO,
  PUBLISH_ALBUM,
  REFRESH_ALBUM,
  RESTORE_PHOTO,
  SELECT_ALBUM,
  SELECT_ALBUM_ID,
  SELECT_ALBUMS,
  SELECT_PHOTO,
  SELECT_PHOTO_BY_HASH,
  SELECT_PHOTOS,
  UPDATE_ALBUM,
  UPDATE_PHOTO_ALT,
} from "./gallery-sql.ts";
import { uuidv7 } from "./ids.ts";

export interface GalleryWrite {
  readonly id: string;
  readonly statement: SqlStatement;
}

export interface PhotoWrite {
  readonly albumId: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly sha256: string;
  readonly consentBy: string;
}

export interface KnownPhoto {
  readonly photo: PanelPhoto;
  readonly live: boolean;
}

export interface GalleryRepo {
  albums(schoolYear: string | undefined): Promise<readonly PanelAlbum[]>;
  album(id: string): Promise<PanelAlbum | undefined>;
  savedAlbum(id: string): Promise<PanelAlbum>;
  albumIdBySlug(schoolYear: string, slug: string): Promise<string | undefined>;
  createAlbumStatement(input: AlbumInput, createdBy: string): GalleryWrite;
  updateAlbumStatement(id: string, input: AlbumInput): SqlStatement;
  publicationStatement(id: string, published: boolean): SqlStatement;
  deleteAlbumStatement(id: string): SqlStatement;
  refreshAlbumStatement(id: string): SqlStatement;
  photos(albumId: string): Promise<readonly PanelPhoto[]>;
  photo(albumId: string, id: string): Promise<PanelPhoto | undefined>;
  savedPhoto(albumId: string, id: string): Promise<PanelPhoto>;
  photoByHash(sha256: string): Promise<KnownPhoto | undefined>;
  createPhotoStatement(write: PhotoWrite): GalleryWrite;
  restorePhotoStatement(id: string, write: PhotoWrite): SqlStatement;
  updatePhotoAltStatement(id: string, alt: string): SqlStatement;
  deletePhotoStatement(id: string): SqlStatement;
}

function albumColumns(input: AlbumInput): readonly string[] {
  const parsed = albumInputSchema.parse(input);
  return [parsed.schoolYear, parsed.slug, parsed.title, parsed.description];
}

type GalleryReads = Pick<
  GalleryRepo,
  | "albums"
  | "album"
  | "savedAlbum"
  | "albumIdBySlug"
  | "photos"
  | "photo"
  | "savedPhoto"
  | "photoByHash"
>;

function galleryReads({ db }: Store): GalleryReads {
  const albumQuery = (id: string): SqlStatement => db.prepare(SELECT_ALBUM).bind(id);
  const photoQuery = (albumId: string, id: string): SqlStatement =>
    db.prepare(SELECT_PHOTO).bind(albumId, id);
  return {
    albums: async (schoolYear) => {
      const query = db.prepare(SELECT_ALBUMS).bind(schoolYear ?? null, MAX_LISTED_ALBUMS);
      return (await allRows(query, albumRowSchema)).map(albumFromRow);
    },
    album: async (id) => {
      const row = await firstRow(albumQuery(id), albumRowSchema);
      return row === undefined ? undefined : albumFromRow(row);
    },
    savedAlbum: async (id) => albumFromRow(albumRowSchema.parse(await albumQuery(id).first())),
    albumIdBySlug: async (schoolYear, slug) => {
      const query = db.prepare(SELECT_ALBUM_ID).bind(schoolYear, slug);
      const row = await firstRow(query, albumIdRowSchema);
      return row?.id;
    },
    photos: async (albumId) => {
      const query = db.prepare(SELECT_PHOTOS).bind(albumId, MAX_ALBUM_PHOTOS);
      return (await allRows(query, photoRowSchema)).map(photoFromRow);
    },
    photo: async (albumId, id) => {
      const row = await firstRow(photoQuery(albumId, id), photoRowSchema);
      return row === undefined ? undefined : photoFromRow(row);
    },
    savedPhoto: async (albumId, id) =>
      photoFromRow(photoRowSchema.parse(await photoQuery(albumId, id).first())),
    photoByHash: async (sha256) => {
      const row = await firstRow(db.prepare(SELECT_PHOTO_BY_HASH).bind(sha256), knownRowSchema);
      return row === undefined ? undefined : { photo: photoFromRow(row), live: row.live === 1 };
    },
  };
}

function galleryWrites({ db, clock, random }: Store): Omit<GalleryRepo, keyof GalleryReads> {
  const newId = (): string => uuidv7(clock().getTime(), random);
  const now = (): string => timestamp(clock);
  return {
    createAlbumStatement: (input, createdBy) => {
      const id = newId();
      const at = now();
      const columns = albumColumns(input);
      return { id, statement: db.prepare(INSERT_ALBUM).bind(id, ...columns, createdBy, at, at) };
    },
    updateAlbumStatement: (id, input) =>
      db.prepare(UPDATE_ALBUM).bind(...albumColumns(input), now(), id),
    publicationStatement: (id, published) =>
      db.prepare(PUBLISH_ALBUM).bind(published ? now() : null, now(), id),
    deleteAlbumStatement: (id) => db.prepare(DELETE_ALBUM).bind(now(), id),
    refreshAlbumStatement: (id) => db.prepare(REFRESH_ALBUM).bind(now(), id),
    createPhotoStatement: ({ albumId, width, height, alt, sha256, consentBy }) => {
      const id = newId();
      const statement = db
        .prepare(INSERT_PHOTO)
        .bind(id, albumId, width, height, alt, sha256, consentBy, now());
      return { id, statement };
    },
    restorePhotoStatement: (id, { albumId, alt, consentBy }) =>
      db.prepare(RESTORE_PHOTO).bind(albumId, alt, consentBy, now(), id),
    updatePhotoAltStatement: (id, alt) => db.prepare(UPDATE_PHOTO_ALT).bind(alt, id),
    deletePhotoStatement: (id) => db.prepare(DELETE_PHOTO).bind(now(), id),
  };
}

export function galleryRepo(store: Store): GalleryRepo {
  return { ...galleryReads(store), ...galleryWrites(store) };
}
