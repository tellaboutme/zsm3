import type { MediaFormat } from "@zsm3/contracts/media";

export const IMMUTABLE = "public, max-age=31536000, immutable";

const SHOWN_INLINE: ReadonlySet<MediaFormat> = new Set(["pdf", "jpg", "png"]);

export function contentDisposition(name: string, format: MediaFormat): string {
  const kind = SHOWN_INLINE.has(format) ? "inline" : "attachment";
  return `${kind}; filename*=UTF-8''${encodeURIComponent(name)}`;
}
