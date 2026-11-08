function countPhrase(count: number, one: string, few: string, many: string): string {
  if (count === 1) {
    return `1 ${one}`;
  }
  const tens = count % 100;
  const ones = count % 10;
  const isFew = ones >= 2 && ones <= 4 && (tens < 12 || tens > 14);
  return `${String(count)} ${isFew ? few : many}`;
}

export function photoCountPhrase(count: number): string {
  return countPhrase(count, "zdjęcie", "zdjęcia", "zdjęć");
}

export function albumCountPhrase(count: number): string {
  return countPhrase(count, "album", "albumy", "albumów");
}

export function photoPositionPhrase(index: number, total: number): string {
  return `Zdjęcie ${String(index + 1)} z ${String(total)}`;
}

export function steppedIndex(index: number, step: number, total: number): number | undefined {
  const next = index + step;
  return step !== 0 && next >= 0 && next < total ? next : undefined;
}

export const SWIPE_MIN_PX = 50;

export function swipeStep(deltaX: number): number {
  if (Math.abs(deltaX) <= SWIPE_MIN_PX) {
    return 0;
  }
  return deltaX < 0 ? 1 : -1;
}

export function keyStep(key: string): number {
  if (key === "ArrowLeft") {
    return -1;
  }
  return key === "ArrowRight" ? 1 : 0;
}
