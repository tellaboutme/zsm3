# ADR 0008: Calm official direction

- Status: accepted
- Date: 2026-11-14
- Amends: [ADR 0002](0002-visual-direction-precyzja.md); sizes only in [ADR 0006](0006-home-profession-index.md) and [ADR 0007](0007-home-profession-index-open.md)

## Context

Built out on every template, direction E "Precyzja" read as a poster rather than a school website. Page titles reached 112 px in wide, heavy, all-capital Archivo, so one word such as „Kadra” filled a third of the first screen. Large solid blue blocks (live status, exam cards, promo cards, counters) competed on one screen. Grey frames stood in for missing photos, and content pages left the right half of a wide screen empty. Every section repeated the same monospaced kicker over a 56 px heading. The staff panel had no shell of its own and looked like a page without styles.

The project owner asked for a calm, official look that still feels fresh: medium, careful type, a precise grid, thin borders on white, the school's blue and orange as accents, and the school's own data (times, qualification codes, dates, address) as the graphic material. Density stays as it is, without empty areas. Motion is moderate. The dark theme is equal to the light one. The panel is redesigned with the same tokens and components as the site.

## Decision

1. **Type scale.** Headings are h1 48 px, h2 32 px, h3 22 px on a wide screen, and about a third smaller on a phone (32, 24, 18). Every page title uses `--step-4`; `--step-title`, which scaled titles with the width of `<main>`, is removed.
2. **Archivo at normal width, weight 700**, sentence case. The wide width (125%) is kept only for the wordmark and for large figures (numbers strip, the contact phone). No heading is set in capitals except abbreviations (ZSM3, BIP, RODO).
3. **Monospace only for data**: dates, times, qualification and document codes, file sizes. Decorative monospaced kickers over sections and page titles are removed; a kicker that carried data moves into a meta line under the lead.
4. **Surfaces.** The page background is a slightly grey `--page`; cards, panels and fields are `--surface` with a 1 px `--line` border, radius 8 px (`--radius`), and no shadow. Shadows stay only on floating elements (menus, dialogs). The background has no radial tones; this also removes the visible edge of the tones on long pages.
5. **Blue fill only for the footer and hover states** (a profession row or tile, a list row). Everywhere else blue is a detail: a status bar, a code, a link, a badge. **Orange only for the primary action** of a screen (Rekrutacja, a form's submit button) and for the focus ring.
6. **Home first screen.** The school's name set modestly with the facts beside it (school types, address), then three equal entries: for candidates (recruitment or the professions), for students (Teraz w szkole) and for parents (the next parents' event). News follow. Without photos every block is complete: a news item without a photo is a text card, never an empty frame.
7. **Teraz w szkole is a compact card** sized by its content: a 3 px blue bar on the left, the title and the timer on one line, a thin progress bar. Outside lessons it says so and names the next school day, with no reserved space for the timer.
8. **Moderate motion.** Blocks appear with a short fade and a shift of at most 8 px in at most 300 ms (`--duration-3`); hover transitions take at most 200 ms (`--duration-2`). Titles no longer rise in line by line. Everything stops with reduced motion. This replaces the 750 ms title entrance of ADR 0002.
9. **Panel shell.** On wide screens the staff panel has a grouped side menu (Treści strony, Uczniowie i rodzice, Administracja, by role, as on the panel home); on narrow screens a Menu button opens the same list. Panel pages use the site's tokens and shared components (buttons, fields, selects, field groups, disclosures, list rows, status badges, empty states, notices).

## Consequences

- Design-system rules 5 (background) and 7 (radius 8 px, status badges are the only pills) change; the other rules stay.
- ADR 0006 and 0007 keep their structure; only their sizes follow this scale (field titles h3, profession names at body size, codes as small chips, blue hover fill kept).
- Almost every visual baseline changes and is reviewed again in both themes at 360, 768, 1280 and 1920 px.
- Large wide type, the title rise and blue panels are no longer signature elements; the signature is the school's own data laid out on a precise grid.
