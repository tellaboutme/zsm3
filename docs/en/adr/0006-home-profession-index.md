# ADR 0006: The home page lists professions as a field index

- Status: accepted
- Date: 2026-11-11
- Amends: [ADR 0002](0002-visual-direction-precyzja.md), "professions presented as filterable tiles by field", for the home page

## Context

The home section "Wybierz zawód" showed all 13 professions as tiles of one shape with a field filter. On a phone the section was almost 3,900 px of near-identical blocks. At 1440 px one title broke mid-word ("elektromobilnoś/ci"). The tile grid is also the pattern the design system's rule 2 warns about.

## Decision

1. On the home page, professions are grouped into an index of the five fields. Each field row shows its name in wide display type, its qualification family (`INF`, `ELM`, `MOT`, `TLO`, `SPL`) and the number of professions.
2. Opening a row lists that field's professions with their qualification codes and study paths, each linking to its programme page. The rows are native exclusive `<details>`: one is open at a time, and no script is needed.
3. The professions listing `/kandydaci/zawody` keeps the filterable tiles and the comparison table.

## Consequences

- The home section is about 600 px on a phone when closed, and no profession name breaks inside a word.
- Topic keywords are no longer on the home page; they remain on the listing and on every programme page.
- The blue fill on hover and the open state keep the direction's signature without the tile grid.
