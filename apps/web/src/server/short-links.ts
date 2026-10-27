import { openLink, type OpenOutcome } from "@zsm3/worker/short-links/resolve.ts";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { rateLimitsRepo } from "@zsm3/worker/storage/rate-limits-repo.ts";
import { shortLinksRepo } from "@zsm3/worker/storage/short-links-repo.ts";
import { SHORT_LINK_KEY } from "astro:env/server";
import { env } from "cloudflare:workers";

export async function openShortLink(code: string): Promise<OpenOutcome> {
  const store = liveStore(env.DB);
  return openLink(
    {
      links: shortLinksRepo(store),
      rateLimits: rateLimitsRepo(store),
      passwordKey: SHORT_LINK_KEY,
    },
    code,
    new Date(),
  );
}
