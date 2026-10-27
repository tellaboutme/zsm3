import { openLink, type OpenOutcome } from "@zsm3/worker/short-links/resolve.ts";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { shortLinksRepo } from "@zsm3/worker/storage/short-links-repo.ts";
import { env } from "cloudflare:workers";

export async function openShortLink(code: string): Promise<OpenOutcome> {
  return openLink({ links: shortLinksRepo(liveStore(env.DB)) }, code, new Date());
}
