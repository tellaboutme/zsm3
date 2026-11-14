# ADR 0007: The home profession index is always open

- Status: accepted; sizes follow [ADR 0008](0008-calm-official-direction.md)
- Date: 2026-11-14
- Amends: [ADR 0006](0006-home-profession-index.md), points 1 and 2

## Context

ADR 0006 grouped the 13 professions into five field rows that open one at a time. On review the closed index read as five oversized all-capital words with a three-letter family code and a large count, and nothing an applicant came for (the professions, their qualification codes, the school type) was visible until a row was opened. The section looked unfinished rather than precise.

## Decision

1. The index stays grouped by the five fields, but every field shows its professions at once; there is no disclosure.
2. Each field is a titled group: the field name in display type in the link colour, sentence case, and next to it (from 48rem of container width) or under it the list of its professions.
3. Each profession row links to its programme page and shows the name with an arrow, the qualification codes as chips and the study paths in the monospace face, stacked. A row fills blue on hover.
4. The qualification family code and the profession count leave the home page; the codes on each row carry the same information.

## Consequences

- An applicant sees every profession, its codes and the school type without a click; the section is about 1,950 px on a 390 px phone instead of about 600 px closed.
- No script or `<details>` behaviour to test; the keyboard reaches every profession in reading order.
- `/kandydaci/zawody` keeps the filterable tiles and the comparison table (ADR 0006, point 3).
