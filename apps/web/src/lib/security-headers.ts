import { bootScript } from "./preferences.ts";

export interface HeaderOptions {
  readonly scriptHashes: readonly string[];
}

export type HeaderEntry = readonly [string, string];

export async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCodePoint(...new Uint8Array(digest)));
}

export function contentSecurityPolicy({ scriptHashes }: HeaderOptions): string {
  const directives: readonly (readonly string[])[] = [
    ["default-src", "'none'"],
    ["script-src", "'self'", ...scriptHashes.map((hash) => `'sha256-${hash}'`)],
    ["style-src", "'self'"],
    ["img-src", "'self'"],
    ["font-src", "'self'"],
    ["connect-src", "'self'"],
    ["manifest-src", "'self'"],
    ["base-uri", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ["require-trusted-types-for", "'script'"],
    ["trusted-types", "'none'"],
  ];
  return directives.map((directive) => directive.join(" ")).join("; ");
}

export const staticHeaders: readonly HeaderEntry[] = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Cross-Origin-Embedder-Policy", "require-corp"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
];

export const ON_DEMAND_CACHE = "public, max-age=0, must-revalidate";

export function pageHeaders(options: HeaderOptions): readonly HeaderEntry[] {
  return [["Content-Security-Policy", contentSecurityPolicy(options)], ...staticHeaders];
}

export async function sitePageHeaders(): Promise<readonly HeaderEntry[]> {
  return pageHeaders({ scriptHashes: [await sha256Base64(bootScript)] });
}

export function renderHeaders(options: HeaderOptions): string {
  return [
    "/*",
    ...pageHeaders(options).map(([name, value]) => `  ${name}: ${value}`),
    "",
    "/_astro/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

export function withHeaders(response: Response, entries: readonly HeaderEntry[]): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of entries) {
    secured.headers.set(name, value);
  }
  return secured;
}
