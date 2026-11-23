# ADR 0010: News as a newspaper

- Status: accepted
- Date: 2026-11-24
- Amends: [ADR 0009](0009-livelier-home-and-featured-photos.md) (category covers of news cards)

## Context

The old school site publishes each news item as a hand-made page with its own styles: gradient heads, chips, number tiles, quote cards, galleries. The owner likes that every post looks its own but rejected a first prototype built from the same devices (colour headers per category, identical cards, number tiles, numbered sections) as generic. Teachers write the posts and want freedom without the risk of producing an ugly page. Most posts have no usable photo: published photos of students need consent.

A prototype in four layouts, a listing and a panel editor went through five rounds of independent design review and was approved.

## Decision

1. **A newspaper, not a landing page.** Variety comes from the scale of the photo, typographic hierarchy and structure, never from colour, boxes or icons. Category colours are removed everywhere, including the home news strip; ADR 0009 point 4 no longer applies.
2. **Type.** Headlines in Archivo at 87 % width; deck and article body in Source Serif 4 (news only); captions, kickers and interface in Source Sans 3; dates in IBM Plex Mono with tabular figures. With the readable-font preference the serif falls back to the readable face. The kicker is a text line that carries information (category · class · place), never a pill.
3. **Four article layouts** chosen per post: _Relacja_ (large photo leads, needs a photo), _Wyniki_ (a results table leads), _Spotkanie_ (essay with a "Następne spotkanie" rail from the calendar), _Komunikat_ (key facts as a definition list and documents, no photo). A layout is a fixed arrangement, not decoration, and can be changed at any time without losing content.
4. **Blocks.** Paragraph, subheading, photo (column, wide or pair), one quote per post, results table, key facts, documents, album link. Number tiles, numbered sections, callout boxes, chips, colour backgrounds, emoji and custom fonts or sizes are not offered.
5. **Photos.** The lead and in-text photos come from the gallery with alt text, caption, credit and a focal point stored as one of nine positions. A photo from another event's album triggers a warning; a post without a photo gets a typographic head, never a placeholder.
6. **Byline and publishing.** Posts are signed "Redakcja ZSM3" and teachers publish directly. An editor can mark one post as the lead story of the listing; without a mark the newest post with a photo of at least 1600 px leads.
7. **Listing.** Lead story, "Najnowsze" and "Co przed nami" beside it, then posts as rows grouped by month; the first post of a month with a photo becomes a medium row, later ones get a thumbnail; the archive goes by month. A lead appears in a row only when it is a complete sentence; otherwise the row shows the title alone.
8. **Before publishing** the editor lists blocking problems (missing title, lead or alt text, empty result rows, a _Relacja_ without a photo) as an error summary with links to the fields, and warnings (long title, capitals, exclamation marks, photo from another album).

## Consequences

- Tokens gain `--font-serif`, `--step-5` and `--rule-color`; the `--tone-*` tokens go away once the home strip is redesigned.
- The news contract, table and panel editor grow: layout, kicker, lead-story flag, cover photo with focus, caption and credit, and the new block types, each validated with Zod and covered by tests.
- Imported posts are re-mapped into the new blocks; leads that are not complete sentences are dropped.
- News page, listing and home strip baselines change and are reviewed again in both themes at 360, 768, 1280 and 1920 px.
