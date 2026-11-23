import { describe, expect, it } from "vitest";

import { featuredBySlot, featuredImage } from "../src/lib/featured.ts";

const HASH = "c".repeat(64);
const WIDE = {
  slot: "home",
  width: 1600,
  height: 900,
  alt: "Budynek szkoły",
  sha256: HASH,
} as const;

describe("featured photos", () => {
  it("indexes photos by their slot", () => {
    const film = { ...WIDE, slot: "film" } as const;
    const map = featuredBySlot([WIDE, film]);
    expect(map.get("home")).toBe(WIDE);
    expect(map.get("film")).toBe(film);
    expect(map.get("szkola")).toBeUndefined();
  });

  it("offers both stored sizes of a landscape photo", () => {
    expect(featuredImage(WIDE)).toEqual({
      src: `/media/g/${HASH}-l.webp`,
      srcset: `/media/g/${HASH}-s.webp 400w, /media/g/${HASH}-l.webp 1600w`,
      width: 1600,
      height: 900,
      alt: "Budynek szkoły",
    });
  });

  it("scales the small width of a portrait photo by its long edge", () => {
    expect(featuredImage({ ...WIDE, width: 900, height: 1600 }).srcset).toBe(
      `/media/g/${HASH}-s.webp 225w, /media/g/${HASH}-l.webp 900w`,
    );
  });
});
