export const ZOOM_STEP = 2;
export const MIN_ZOOM_GAIN = 1.1;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function zoomedSize(fitted: Size, natural: Size): Size | undefined {
  if (fitted.width <= 0) {
    return undefined;
  }
  const scale = Math.min(ZOOM_STEP, natural.width / fitted.width);
  if (scale < MIN_ZOOM_GAIN) {
    return undefined;
  }
  const width = Math.round(fitted.width * scale);
  return { width, height: Math.round((width * natural.height) / natural.width) };
}

export function anchorFraction(pointer: number, start: number, length: number): number {
  if (length <= 0) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, (pointer - start) / length));
}

export function anchoredScroll(
  fraction: number,
  content: number,
  viewport: number,
  offset: number,
): number {
  const limit = Math.max(0, content - viewport);
  return Math.min(limit, Math.max(0, fraction * content - offset));
}
