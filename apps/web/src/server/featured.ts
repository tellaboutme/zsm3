import { liveStore } from "@zsm3/worker/storage/database.ts";
import { featuredRepo } from "@zsm3/worker/storage/featured-repo.ts";
import { env } from "cloudflare:workers";

import { featuredBySlot, type FeaturedPhotos } from "../lib/featured.ts";

export async function featuredPhotos(): Promise<FeaturedPhotos> {
  return featuredBySlot(await featuredRepo(liveStore(env.DB)).published());
}
