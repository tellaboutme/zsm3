import { resolveLegacyRedirect, shouldLookupLegacyRedirect } from "./legacy-redirect.ts";
import { ON_DEMAND_CACHE, sitePageHeaders } from "../src/lib/security-headers.ts";

export async function routeLegacyRequest(
  request: Request,
  response: Response,
  lookup: (path: string) => string | undefined | Promise<string | undefined>,
  exists: (path: string) => boolean | Promise<boolean>,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (!shouldLookupLegacyRedirect(request.method, pathname, response.status)) {
    return response;
  }
  let target: string | undefined;
  try {
    target = await resolveLegacyRedirect(pathname, lookup, exists);
  } catch {
    return response;
  }
  if (target === undefined) {
    return response;
  }
  const headers = new Headers(Object.fromEntries(await sitePageHeaders()));
  headers.set("Cache-Control", ON_DEMAND_CACHE);
  headers.set("Location", target);
  return new Response(null, {
    status: 301,
    headers,
  });
}
