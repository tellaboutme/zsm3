import { LARGE_LONG_EDGE, SMALL_LONG_EDGE } from "@zsm3/contracts/gallery";

export interface PhotoSize {
  readonly width: number;
  readonly height: number;
}

const ROUNDING_TOLERANCE = 1;

function longEdge(size: PhotoSize): number {
  return Math.max(size.width, size.height);
}

function scaledMatches(small: number, large: number, scale: number): boolean {
  return Math.abs(small - large * scale) <= ROUNDING_TOLERANCE;
}

export function variantsFit(small: PhotoSize, large: PhotoSize): boolean {
  const edge = longEdge(large);
  if (edge < SMALL_LONG_EDGE || edge > LARGE_LONG_EDGE || longEdge(small) !== SMALL_LONG_EDGE) {
    return false;
  }
  const scale = SMALL_LONG_EDGE / edge;
  return (
    scaledMatches(small.width, large.width, scale) &&
    scaledMatches(small.height, large.height, scale)
  );
}
