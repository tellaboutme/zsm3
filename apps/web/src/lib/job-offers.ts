import type { JobOffers } from "@zsm3/contracts/datasets";

export type JobOffer = JobOffers[number];

export interface OfferBoard {
  readonly current: readonly JobOffer[];
  readonly archive: readonly JobOffer[];
}

export function offerBoard(offers: readonly JobOffer[], today: string): OfferBoard {
  return {
    current: offers
      .filter((offer) => offer.validUntil >= today)
      .toSorted((first, second) => first.validUntil.localeCompare(second.validUntil)),
    archive: offers
      .filter((offer) => offer.validUntil < today)
      .toSorted((first, second) => second.validUntil.localeCompare(first.validUntil)),
  };
}
