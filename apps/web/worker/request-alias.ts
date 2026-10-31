import { ON_DEMAND_CACHE, sitePageHeaders } from "../src/lib/security-headers.ts";

const ALIASES = new Map([
  ["/uczniowie/e-wniosek", "/e-wniosek"],
  ["/uczniowie/e-wniosek/status", "/e-wniosek/status"],
]);

export async function requestAlias(request: Request): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return undefined;
  }
  const target = ALIASES.get(new URL(request.url).pathname);
  if (target === undefined) {
    return undefined;
  }
  const headers = new Headers(Object.fromEntries(await sitePageHeaders()));
  headers.set("Cache-Control", ON_DEMAND_CACHE);
  headers.set("Location", target);
  return new Response(null, { status: 308, headers });
}
