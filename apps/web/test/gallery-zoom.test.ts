import { describe, it } from "vitest";

import {
  anchorFraction,
  anchoredScroll,
  MIN_ZOOM_GAIN,
  ZOOM_STEP,
  zoomedSize,
} from "../src/lib/gallery-zoom.ts";

describe("zoomed size", () => {
  it("doubles a photo fitted well below its natural size", ({ expect }) => {
    expect(ZOOM_STEP).toBe(2);
    expect(zoomedSize({ width: 573, height: 764 }, { width: 1600, height: 2133 })).toEqual({
      width: 1146,
      height: 1528,
    });
  });

  it("stops at the natural size instead of enlarging past it", ({ expect }) => {
    expect(zoomedSize({ width: 358, height: 477 }, { width: 500, height: 667 })).toEqual({
      width: 500,
      height: 666,
    });
  });

  it("keeps the fitted aspect ratio", ({ expect }) => {
    const zoomed = zoomedSize({ width: 287, height: 764 }, { width: 600, height: 1600 });
    expect(zoomed).toEqual({ width: 574, height: 1528 });
  });

  it("refuses a zoom that would not visibly enlarge the photo", ({ expect }) => {
    expect(MIN_ZOOM_GAIN).toBe(1.1);
    expect(zoomedSize({ width: 480, height: 320 }, { width: 480, height: 320 })).toBeUndefined();
    expect(zoomedSize({ width: 440, height: 293 }, { width: 480, height: 320 })).toBeUndefined();
    expect(zoomedSize({ width: 436, height: 291 }, { width: 480, height: 320 })).toEqual({
      width: 480,
      height: 320,
    });
    expect(zoomedSize({ width: 400, height: 300 }, { width: 440, height: 330 })).toEqual({
      width: 440,
      height: 330,
    });
  });

  it("refuses to zoom a photo that has no size yet", ({ expect }) => {
    expect(zoomedSize({ width: 0, height: 0 }, { width: 1600, height: 1067 })).toBeUndefined();
    expect(zoomedSize({ width: 400, height: 300 }, { width: 0, height: 0 })).toBeUndefined();
  });
});

describe("anchor fraction", () => {
  it("places a pointer within the photo", ({ expect }) => {
    expect(anchorFraction(150, 100, 200)).toBe(0.25);
  });

  it("clamps a pointer outside the photo to its edge", ({ expect }) => {
    expect(anchorFraction(50, 100, 200)).toBe(0);
    expect(anchorFraction(400, 100, 200)).toBe(1);
  });

  it("falls back to the centre of a photo without length", ({ expect }) => {
    expect(anchorFraction(150, 100, 0)).toBe(0.5);
  });
});

describe("anchored scroll", () => {
  it("keeps the anchored point under the pointer", ({ expect }) => {
    expect(anchoredScroll(0.5, 2000, 800, 300)).toBe(700);
  });

  it("stops at the start and the end of the photo", ({ expect }) => {
    expect(anchoredScroll(0.05, 2000, 800, 300)).toBe(0);
    expect(anchoredScroll(0.95, 2000, 800, 100)).toBe(1200);
  });

  it("does not scroll a photo that fits the stage", ({ expect }) => {
    expect(anchoredScroll(0.9, 600, 800, 0)).toBe(0);
  });
});
