import {
  FEATURED_SLOT_LABELS,
  type FeaturedSlot,
  type PanelFeaturedPhoto,
} from "@zsm3/contracts/featured";

export function featuredPath(slot: FeaturedSlot): string {
  return `/api/panel/featured/${slot}`;
}

export function featuredSetPhrase(slot: FeaturedSlot, published: boolean): string {
  const set = `Zdjęcie jest teraz wyróżnione: ${FEATURED_SLOT_LABELS[slot]}.`;
  return published ? set : `${set} Odwiedzający zobaczą je dopiero po opublikowaniu albumu.`;
}

export function featuredClearedPhrase(slot: FeaturedSlot): string {
  return `Usunięto wyróżnienie: ${FEATURED_SLOT_LABELS[slot]}.`;
}

export function featuredRowText(item: PanelFeaturedPhoto): string {
  const state = item.published
    ? "widoczne na stronie"
    : "album nieopublikowany, zdjęcie niewidoczne";
  return `${FEATURED_SLOT_LABELS[item.slot]}: ${item.alt} · album „${item.albumTitle}” · ${state}`;
}

export function featuredCountPhrase(count: number): string {
  return count === 0
    ? "Brak wyróżnionych zdjęć. Wyróżnij zdjęcie w albumie."
    : `Wyróżnionych zdjęć: ${String(count)}.`;
}
