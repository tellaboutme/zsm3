import { z } from "zod";

import { LARGE_LONG_EDGE } from "./gallery-limits.ts";
import { sha256Schema } from "./media.ts";

export const FEATURED_SLOTS = [
  "home",
  "film",
  "kandydaci",
  "uczniowie",
  "rodzice",
  "szkola",
] as const;

export const featuredSlotSchema = z.enum(FEATURED_SLOTS);

export type FeaturedSlot = z.infer<typeof featuredSlotSchema>;

export const FEATURED_SLOT_LABELS: Readonly<Record<FeaturedSlot, string>> = {
  home: "Strona główna",
  film: "Film o szkole",
  kandydaci: "Kandydaci",
  uczniowie: "Uczniowie",
  rodzice: "Rodzice",
  szkola: "Szkoła",
};

export const FEATURED_ROUTE_NAMES = ["featured.list", "featured.set", "featured.clear"] as const;

export const featuredSetSchema = z.strictObject({ photoId: z.uuid() });

const dimension = z.int().min(1).max(LARGE_LONG_EDGE);

export const publicFeaturedPhotoSchema = z.strictObject({
  slot: featuredSlotSchema,
  width: dimension,
  height: dimension,
  alt: z.string().min(1),
  sha256: sha256Schema,
});

export const panelFeaturedPhotoSchema = publicFeaturedPhotoSchema.extend({
  photoId: z.uuid(),
  albumId: z.uuid(),
  albumTitle: z.string().min(1),
  published: z.boolean(),
  updatedAt: z.string().min(1),
});

export const panelFeaturedListSchema = z.strictObject({
  items: z.array(panelFeaturedPhotoSchema).max(FEATURED_SLOTS.length),
});

export type PublicFeaturedPhoto = z.infer<typeof publicFeaturedPhotoSchema>;
export type PanelFeaturedPhoto = z.infer<typeof panelFeaturedPhotoSchema>;
