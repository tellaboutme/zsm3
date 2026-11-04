import { liveStore } from "@zsm3/worker/storage/database.ts";
import {
  galleryPublicRepo,
  type GalleryPublicRepo,
} from "@zsm3/worker/storage/gallery-public-repo.ts";
import { env } from "cloudflare:workers";

export function galleryReader(): GalleryPublicRepo {
  return galleryPublicRepo(liveStore(env.DB));
}
