import { MAX_PHOTO_VARIANT_BYTES } from "@zsm3/contracts/gallery";
import fc from "fast-check";
import { describe, it } from "vitest";

import { fitsVariantLimit, photoSizes, WEBP_QUALITIES } from "../src/lib/panel/photo-sizing.ts";

describe("photoSizes", () => {
  it("scales a large landscape photo to both long edges", ({ expect }) => {
    expect(photoSizes({ width: 4000, height: 3000 })).toEqual({
      small: { width: 400, height: 300 },
      large: { width: 1600, height: 1200 },
    });
  });

  it("scales a portrait photo by its height", ({ expect }) => {
    expect(photoSizes({ width: 3000, height: 4000 })).toEqual({
      small: { width: 300, height: 400 },
      large: { width: 1200, height: 1600 },
    });
  });

  it("never enlarges the large variant", ({ expect }) => {
    expect(photoSizes({ width: 800, height: 600 })?.large).toEqual({ width: 800, height: 600 });
  });

  it("accepts exactly 400 px and refuses less", ({ expect }) => {
    expect(photoSizes({ width: 400, height: 10 })?.small).toEqual({ width: 400, height: 10 });
    expect(photoSizes({ width: 399, height: 399 })).toBeUndefined();
  });

  it("keeps a sliver at least one pixel tall", ({ expect }) => {
    expect(photoSizes({ width: 8000, height: 1 })).toEqual({
      small: { width: 400, height: 1 },
      large: { width: 1600, height: 1 },
    });
  });

  it("gives every photo the sizes the server demands", ({ expect }) => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12000 }),
        fc.integer({ min: 1, max: 12000 }),
        (w, h) => {
          const sizes = photoSizes({ width: w, height: h });
          if (Math.max(w, h) < 400) {
            return sizes === undefined;
          }
          const small = sizes?.small;
          const large = sizes?.large;
          return (
            small !== undefined &&
            large !== undefined &&
            Math.max(small.width, small.height) === 400 &&
            Math.max(large.width, large.height) <= 1600 &&
            Math.max(large.width, large.height) >= 400
          );
        },
      ),
    );
    expect.assertions(0);
  });
});

describe("WEBP_QUALITIES", () => {
  it("steps quality down from the normal setting", ({ expect }) => {
    expect(WEBP_QUALITIES).toEqual([82, 72, 60, 48]);
  });
});

describe("fitsVariantLimit", () => {
  it("allows exactly the server limit", ({ expect }) => {
    expect(fitsVariantLimit(MAX_PHOTO_VARIANT_BYTES)).toBe(true);
    expect(fitsVariantLimit(MAX_PHOTO_VARIANT_BYTES + 1)).toBe(false);
  });
});
