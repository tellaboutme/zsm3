import { createHash } from "node:crypto";

export interface HeaderOptions {
  readonly scriptHashes: readonly string[];
}

export function sha256Base64(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("base64");
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

export const staticHeaders: readonly (readonly [string, string])[] = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Cross-Origin-Embedder-Policy", "require-corp"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
];

export function renderHeaders(options: HeaderOptions): string {
  const pageHeaders = [
    ["Content-Security-Policy", contentSecurityPolicy(options)],
    ...staticHeaders,
  ];
  return [
    "/*",
    ...pageHeaders.map(([name, value]) => `  ${name}: ${value}`),
    "",
    "/_astro/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}
