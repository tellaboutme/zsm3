import { it } from "vitest";

import { variantsFit } from "../../src/media/photo-variants.ts";

const size = (width: number, height: number): { width: number; height: number } => ({
  width,
  height,
});

it("accepts variants scaled from the same picture", ({ expect }) => {
  expect(variantsFit(size(400, 225), size(1600, 900))).toBe(true);
  expect(variantsFit(size(225, 400), size(900, 1600))).toBe(true);
  expect(variantsFit(size(400, 400), size(400, 400))).toBe(true);
  expect(variantsFit(size(400, 300), size(800, 600))).toBe(true);
  expect(variantsFit(size(400, 226), size(1600, 900))).toBe(true);
  expect(variantsFit(size(400, 224), size(1600, 900))).toBe(true);
});

it("refuses sizes outside the allowed long edges", ({ expect }) => {
  expect(variantsFit(size(400, 225), size(1601, 900))).toBe(false);
  expect(variantsFit(size(399, 224), size(399, 224))).toBe(false);
  expect(variantsFit(size(400, 225), size(399, 224))).toBe(false);
  expect(variantsFit(size(399, 225), size(1600, 900))).toBe(false);
  expect(variantsFit(size(401, 225), size(1600, 900))).toBe(false);
  expect(variantsFit(size(400, 225), size(900, 1601))).toBe(false);
});

it("refuses variants of different pictures", ({ expect }) => {
  expect(variantsFit(size(400, 227), size(1600, 900))).toBe(false);
  expect(variantsFit(size(400, 223), size(1600, 900))).toBe(false);
  expect(variantsFit(size(225, 400), size(1600, 900))).toBe(false);
  expect(variantsFit(size(400, 225), size(900, 1600))).toBe(false);
});
