import { liveStore } from "@zsm3/worker/storage/database.ts";
import { pagesRepo, type PagesRepo } from "@zsm3/worker/storage/pages-repo.ts";
import { env } from "cloudflare:workers";

export type PagesReader = Omit<PagesRepo, "save">;

export function pagesReader(): PagesReader {
  return pagesRepo(liveStore(env.DB));
}
