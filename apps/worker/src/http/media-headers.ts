import type { MediaFormat } from "@zsm3/contracts/media";

export const IMMUTABLE = "public, max-age=31536000, immutable";
export const PRIVATE_DOWNLOAD = "private, no-store";

const SHOWN_INLINE: ReadonlySet<MediaFormat> = new Set(["pdf", "jpg", "png"]);
const COMBINING_MARKS = /\p{M}/gu;
const ASCII_FALLBACK = /[^\w.-]/gu;
const RESERVED_IN_EXTENDED_VALUE = /['()*]/gu;

function extendedValue(name: string): string {
  return encodeURIComponent(name).replace(
    RESERVED_IN_EXTENDED_VALUE,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function contentDisposition(name: string, format: MediaFormat): string {
  const kind = SHOWN_INLINE.has(format) ? "inline" : "attachment";
  return `${kind}; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function attachmentDisposition(name: string): string {
  const fallback = name.normalize("NFKD").replace(COMBINING_MARKS, "").replace(ASCII_FALLBACK, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${extendedValue(name)}`;
}
