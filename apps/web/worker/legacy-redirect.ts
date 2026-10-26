import { sitePathSchema } from "@zsm3/contracts/content";
import { normalisePath } from "@zsm3/worker/storage/redirects-repo.ts";

import { isReadMethod } from "../src/lib/page-methods.ts";

export function shouldLookupLegacyRedirect(method: string, path: string, status: number): boolean {
  if (!isReadMethod(method) || status !== 404) {
    return false;
  }
  const normalised = path.toLowerCase();
  return (
    !/\.(?:ico|txt|xml|json|css|m?js|map|png|jpe?g|webp|svg|gif|avif|woff2?|ttf|pdf|webmanifest|wasm|mp4|webm)$/u.test(
      normalised,
    ) &&
    ["/api", "/media", "/panel", "/_astro", "/.well-known"].every(
      (prefix) => normalised !== prefix && !normalised.startsWith(`${prefix}/`),
    )
  );
}

export function legacyRedirectTarget(path: string, target: string | undefined): string | undefined {
  const parsed = sitePathSchema.safeParse(target);
  return parsed.success && normalisePath(path) !== parsed.data ? parsed.data : undefined;
}

const MAX_REDIRECT_HOPS = 8;

export async function resolveLegacyRedirect(
  path: string,
  lookup: (path: string) => string | undefined | Promise<string | undefined>,
  exists: (path: string) => boolean | Promise<boolean>,
): Promise<string | undefined> {
  const visited = new Set([normalisePath(path)]);
  let current = path;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
    const row = await lookup(current);
    if (row === undefined) {
      return undefined;
    }
    const target = legacyRedirectTarget(current, row);
    if (
      target === undefined ||
      !shouldLookupLegacyRedirect("GET", target, 404) ||
      visited.has(target)
    ) {
      return undefined;
    }
    visited.add(target);
    if (await exists(target)) {
      return target;
    }
    current = target;
  }
  return undefined;
}
