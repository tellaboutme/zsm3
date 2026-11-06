import {
  LARGE_LONG_EDGE,
  MAX_PHOTO_VARIANT_BYTES,
  SMALL_LONG_EDGE,
} from "@zsm3/contracts/gallery-limits";

export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
export const WEBP_QUALITIES: readonly number[] = [82, 72, 60, 48];

export interface PhotoSize {
  readonly width: number;
  readonly height: number;
}

export interface PhotoSizes {
  readonly small: PhotoSize;
  readonly large: PhotoSize;
}

function scaled({ width, height }: PhotoSize, longEdge: number): PhotoSize {
  const scale = longEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function photoSizes(source: PhotoSize): PhotoSizes | undefined {
  const longEdge = Math.max(source.width, source.height);
  if (longEdge < SMALL_LONG_EDGE) {
    return undefined;
  }
  return {
    small: scaled(source, SMALL_LONG_EDGE),
    large: scaled(source, Math.min(longEdge, LARGE_LONG_EDGE)),
  };
}

export function fitsVariantLimit(bytes: number): boolean {
  return bytes <= MAX_PHOTO_VARIANT_BYTES;
}
