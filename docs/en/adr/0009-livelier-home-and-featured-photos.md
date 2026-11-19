# ADR 0009: Livelier home and featured photos

- Status: accepted
- Date: 2026-11-19
- Amends: [ADR 0008](0008-calm-official-direction.md); design-system rules 1, 5 and 6 for the cases listed below

## Context

Shown on phones to students and teachers, the calm direction of ADR 0008 read as unfinished: the site had no photograph anywhere, every block was text in the same bordered card, the four section hubs looked identical, and the home head left an empty gap between the school name and the address. Testers asked for a centred home head, a news strip that can be swiped, a place for the school film and its social profiles, and photos in the gallery.

The project owner compared working prototypes of each block and chose one variant per block (A3, B1, C1, D1, E2, F1).

Photos of the school may not live in the public repository. The gallery already stores photos in R2 with checked variants (400 and 1600 px), alt text and an audit trail, so it is the only way a photo reaches a page.

## Decision

1. **Featured photos.** Staff mark a published gallery photo as the featured photo of a slot: the home head, the school film, or one of the four hubs. One photo per slot, set and cleared in the panel, recorded in the audit log. A slot without a photo renders the block as before, so no page depends on a photo.
2. **Home head (A3).** The school name is centred over the featured home photo, with a flat dark scrim token for contrast, three actions (recruitment as the primary one) and the live lesson line. Without a photo the head is centred on `--page`.
3. **Live status (C1).** Teraz w szkole is a ring that fills towards the bell, blue during a lesson and orange during a break, with the time left in the monospace face. More than an hour before the first lesson the ring shows its start time instead of a countdown; after the last lesson and on days off the card names the next school day, as before.
4. **News strip (B1).** The latest news are a horizontal strip, newest on the left, moved only by the user (swipe, scroll or the two arrow buttons), with a position counter and a last card that links to all news. Until a news item has a photo, its card has a cover in the colour of its category, from a fixed set of category tokens, with the date set large.
5. **Film and profiles (D1).** The home shows the school film as a poster (the featured film photo) with a play button. The YouTube player (`youtube-nocookie.com`) is created only after the click, so nothing is loaded from YouTube and no cookie is set before it; the privacy policy says so. Next to it are four tiles: Instagram, Facebook, YouTube and the virtual tour.
6. **Hub heads (E2).** A hub with a featured photo shows its title over the photo, with the same scrim as the home head; without one it keeps its current head.
7. **Gallery (F1).** The gallery is filled with real photos of the building and workshops without people until the school provides photos with consent.

## Consequences

- Design-system rule 1 allows the centred head over a photo on the home only; rule 5 allows the flat photo scrim; rule 6 allows the category covers of news cards and the live ring colours. The remaining rules stay, including rule 18: nothing moves by itself.
- The Content Security Policy gains `frame-src https://www.youtube-nocookie.com`, covered by the header tests.
- The home becomes heavier by one responsive photo; it is the largest contentful element, loaded with high priority, and the Lighthouse budgets are checked again.
- Visual baselines use the synthetic seed photos for every slot; real photos exist only in the deployed data.
- Home, hub, news card and live status baselines change and are reviewed again in both themes at 360, 768, 1280 and 1920 px.
