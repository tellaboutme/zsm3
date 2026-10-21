# ADR 0002: Visual direction "Precyzja"

- Status: accepted
- Date: 2026-10-22

## Context

Five directions were prototyped on real school content: A (technical drawing), B (departure board), C (workshop), D (academic navy and serif) and E (modern engineering). The project owner found A–C too subdued and asked for a site that is official but stylish, with noticeable motion and official colours. D and E were built in that brief; E was chosen.

## Decision

The website uses direction E, "Precyzja":

- white base, the school's blue (`#0b4fb3`) for brand surfaces and links, the school's orange (`#f26b1d`) for the primary action and live state;
- Archivo in wide widths and heavy weight for titles and numbers, Source Sans 3 for text, IBM Plex Mono for tags, dates and codes;
- large titles that rise in on load, scroll-driven reveals, blue fills on hover, cross-page view transitions, all disabled with reduced motion;
- professions presented as filterable tiles by field.

## Consequences

- The motion rules of the design system are relaxed from "200 ms, almost no motion" to the noticeable motion described in the [blueprint](../blueprint.md) §1.4, still with no auto-rotation, loops or parallax.
- Orange is reserved for actions and large elements; small text uses blue or ink to keep 4.5:1 contrast.
- Prototype code is discarded; stage 1 rebuilds the direction as components with full tests.
