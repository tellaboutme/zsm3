import type { FeaturedSlot, PublicFeaturedPhoto } from "@zsm3/contracts/featured";
import { SMALL_LONG_EDGE } from "@zsm3/contracts/gallery-limits";
import { photoPath } from "@zsm3/contracts/gallery-public";

export interface FeaturedImage {
  readonly src: string;
  readonly srcset: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export type FeaturedPhotos = ReadonlyMap<FeaturedSlot, PublicFeaturedPhoto>;

export function featuredBySlot(items: readonly PublicFeaturedPhoto[]): FeaturedPhotos {
  return new Map(items.map((item) => [item.slot, item]));
}

export function featuredImage(photo: PublicFeaturedPhoto): FeaturedImage {
  const smallWidth = Math.round(
    (photo.width * SMALL_LONG_EDGE) / Math.max(photo.width, photo.height),
  );
  const large = photoPath(photo.sha256, "l");
  return {
    src: large,
    srcset: `${photoPath(photo.sha256, "s")} ${String(smallWidth)}w, ${large} ${String(photo.width)}w`,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
  };
}
