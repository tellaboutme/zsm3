import {
  publicAlbumListSchema,
  publicAlbumViewSchema,
  publicYearListSchema,
  schoolYearFromSlug,
} from "@zsm3/contracts/gallery-public";
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app-env.ts";
import { GALLERY_CACHE } from "../http/media-headers.ts";
import { problemResponse } from "../http/problem.ts";
import { liveStore } from "../storage/database.ts";
import { galleryPublicRepo, type GalleryPublicRepo } from "../storage/gallery-public-repo.ts";

function reader(c: Context<AppEnv>): GalleryPublicRepo {
  return galleryPublicRepo(liveStore(c.env.DB));
}

function cached(c: Context<AppEnv>, body: object): Response {
  return c.json(body, 200, { "Cache-Control": GALLERY_CACHE });
}

export const galleryRoutes = new Hono<AppEnv>()
  .get("/years", async (c) =>
    cached(c, publicYearListSchema.parse({ items: await reader(c).years() })),
  )
  .get("/years/:year/albums", async (c) => {
    const schoolYear = schoolYearFromSlug(c.req.param("year"));
    if (schoolYear === undefined) {
      return problemResponse(c, 404);
    }
    return cached(c, publicAlbumListSchema.parse({ items: await reader(c).albums(schoolYear) }));
  })
  .get("/albums/:id", async (c) => {
    const id = z.uuid().safeParse(c.req.param("id"));
    const view = id.success ? await reader(c).albumById(id.data) : undefined;
    return view === undefined
      ? problemResponse(c, 404)
      : cached(c, publicAlbumViewSchema.parse(view));
  });
