import { describe, it } from "vitest";

import {
  albumCountPhrase,
  keyStep,
  photoPositionPhrase,
  steppedIndex,
  SWIPE_MIN_PX,
  swipeStep,
} from "../src/lib/gallery.ts";

describe("gallery phrases", () => {
  it("declines album counts", ({ expect }) => {
    expect([1, 2, 5, 12, 22].map(albumCountPhrase)).toEqual([
      "1 album",
      "2 albumy",
      "5 albumów",
      "12 albumów",
      "22 albumy",
    ]);
  });

  it("states a photo's place in its album", ({ expect }) => {
    expect(photoPositionPhrase(0, 5)).toBe("Zdjęcie 1 z 5");
  });
});

describe("lightbox moves", () => {
  it("stays inside the album and ignores a zero step", ({ expect }) => {
    expect(steppedIndex(0, 1, 2)).toBe(1);
    expect(steppedIndex(1, -1, 2)).toBe(0);
    expect(steppedIndex(0, -1, 2)).toBeUndefined();
    expect(steppedIndex(1, 1, 2)).toBeUndefined();
    expect(steppedIndex(1, 0, 2)).toBeUndefined();
  });

  it("maps the arrow keys and nothing else", ({ expect }) => {
    expect(keyStep("ArrowLeft")).toBe(-1);
    expect(keyStep("ArrowRight")).toBe(1);
    expect(keyStep("Enter")).toBe(0);
  });

  it("treats only a long enough swipe as a move", ({ expect }) => {
    expect(swipeStep(-SWIPE_MIN_PX - 1)).toBe(1);
    expect(swipeStep(SWIPE_MIN_PX + 1)).toBe(-1);
    expect(swipeStep(SWIPE_MIN_PX)).toBe(0);
    expect(swipeStep(-SWIPE_MIN_PX)).toBe(0);
  });
});
