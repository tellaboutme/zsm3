# Design system

How the website looks, reads and behaves. The rules here are binding for every page and component. The site plan is in [site-plan.md](site-plan.md).

## 1. Character

ZSM3 is a technical school: cars, aircraft, robots, code. Its students build and repair machines; its partners include an airport ground-handling company. The website should feel like a well-made technical object: precise, legible, honest about materials, and proud of the work done in the workshops. It should not feel like a startup landing page or a template.

Chosen direction: **E "Precyzja"** ([ADR 0002](adr/0002-visual-direction-precyzja.md)) in its **calm official** form ([ADR 0008](adr/0008-calm-official-direction.md)): official and fresh rather than loud. Medium, careful type on a precise grid; thin borders on white surfaces over a slightly grey page; the school's blue and orange as accents; the school's own data (times, qualification codes, dates, the address) as the graphic material. A profession index on the home page and filterable profession tiles on the listing ([ADR 0006](adr/0006-home-profession-index.md), [ADR 0007](adr/0007-home-profession-index-open.md)). Moderate motion. The dark theme is equal to the light one, a calm graphite navy without bright fills. Foundation values (grid, type, colour, motion) and the page-by-page construction plan are in the [blueprint](blueprint.md).

Directions A–D were prototyped on real content and set aside: A (technical drawing), B (departure board) and C (workshop photography) read as too subdued; D (academic navy and serif) as more formal than energetic.

## 2. Rules against generic design

Every review checks these. Each one is a yes/no question.

**Layout and composition**

1. No centred hero with a headline, a sub-headline and two buttons over a gradient or a blurred photo.
2. No default grid of identical cards with an icon, a title and two lines of text. Cards exist only where items are truly parallel (programmes, news), and then they show real content (photo, date, qualification codes).
3. An asymmetric editorial grid with a clear reading order; alignment to the grid, not to the centre.
4. Whitespace is used to group, never to pad out thin content.

**Colour and surface**

5. No gradients, glow, glassmorphism, textures or background tones; no drop shadows used as decoration. The page background is a flat `--page` (slightly grey in light, deep navy in dark); cards, panels and fields are `--surface` with a 1 px `--line` border. Elevation appears only where an element actually floats (menus, dialogs).
6. Colour only through tokens. A solid blue fill appears only on the footer and on hover (a profession row or tile, a list row); everywhere else blue is a detail: a status bar, a code, a link, a badge. Orange marks the one primary action of a screen and the focus ring. Everything else is neutral.
7. One small radius, 8 px (`--radius`); only shapes that are round by design, such as the switch toggles, use the full round token (`--radius-round`). Nothing is a pill unless it is a status badge.

**Typography**

8. No Inter, Poppins, Montserrat, Space Grotesk or Geist. Typefaces are chosen for this school and must render Polish diacritics perfectly (test string: `Zażółć gęślą jaźń ŹŻĆŃĄŚŁĘÓ`).
9. A typographic scale with real contrast between levels (h1 48, h2 32, h3 22 px on a wide screen; about a third smaller on a phone); at most two families plus one monospace. No heading is set in capitals except abbreviations (ZSM3, BIP, RODO).
10. Numbers that matter (times, dates, counts, qualification codes) are set in tabular figures.

**Imagery and icons**

11. Only real photos of the school, its people and its workshops, used with consent. No stock photos, no AI-generated images, no illustrations of generic "students with laptops".
12. No emoji as icons. Icons only where a label alone is not enough, from one set, always next to text.
13. Every image has meaningful alt text, or an empty alt if it is decorative.

**Copy (Polish)**

14. No filler: "Witamy na stronie naszej szkoły", "Twoja przyszłość zaczyna się tutaj", "nowoczesna", "innowacyjna", "odkryj", "pasja" without evidence. Say the concrete thing instead: what the student will do, where, with what equipment, with which qualification.
15. Plain Polish (język prosty): short sentences, active voice, the most important information first, no bureaucratic chains of nouns.
16. Headings say what the section contains, not a slogan.

**Motion**

17. Motion explains or rewards an action (entering a page, revealing a section, hovering, changing a filter); nothing moves on its own except live data. It uses the motion tokens and patterns of the [blueprint](blueprint.md) §1.4, never delays content, and stops completely with `prefers-reduced-motion`.
18. No parallax, no scroll-jacking, no auto-rotating carousels, no counters that animate from zero.

**Substance**

19. Every element on a page answers a real question of one of the audiences in the site plan. If removing it loses no information, it is removed.
20. Every claim is checkable: numbers have a source and a date.

## 3. Tokens

All colours, sizes, spacing, radii, durations and z-indices are CSS custom properties in `apps/web/src/styles/tokens.css`. Stylelint rejects colour literals anywhere else.

| Group  | Tokens                                                                                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour | `--page`, `--surface`, `--ink`, `--ink-2`, `--line`, `--line-strong`, `--blue`, `--link`, `--orange`, `--success`, `--warning`, `--danger`, `--focus`, each defined for light and dark |
| Type   | `--font-display`, `--font-body`, `--font-mono`, `--step-n1` … `--step-4` (fluid `clamp()` scale), `--weight-heading`, `--leading-*`, `--stretch-*`                                     |
| Space  | `--space-1` … `--space-8` on a 4 px base                                                                                                                                               |
| Layout | `--measure` (65ch), `--grid-columns`, `--gutter`, `--page-max`                                                                                                                         |
| Shape  | `--radius` (8 px), `--radius-round`, `--hairline`, `--rule` (status bars and the active menu item)                                                                                     |
| Motion | `--ease`, `--duration-1`, `--duration-2` (hover, ≤ 200 ms), `--duration-3` (block entrance, ≤ 300 ms), `--shift` (≤ 8 px)                                                              |

Contrast: body text at least 7:1 (AAA) in both themes, large text and UI elements at least 4.5:1; field borders (`--line-strong`) at least 3:1 against `--surface`. The accessibility settings (larger text, high contrast, greyscale, underlined links, readable font) are token overrides, not separate styles.

## 4. Typography

Fonts are self-hosted WOFF2, subset to Latin and Latin Extended; Archivo and Source Sans 3 are preloaded.

| Role                  | Face                            | Note                                                                  |
| --------------------- | ------------------------------- | --------------------------------------------------------------------- |
| Display               | Archivo (width 100, weight 700) | titles in sentence case; width 125 only for large figures             |
| Body                  | Source Sans 3                   | text, navigation, forms, labels                                       |
| Mono                  | IBM Plex Mono                   | data only: dates, times, qualification and document codes, file sizes |
| Readable font setting | Atkinson Hyperlegible Next      | replaces the body face when chosen in the accessibility settings      |

All faces render the Polish test string correctly. Decorative monospaced kickers over sections and page titles are not used; a page head is breadcrumbs, title, lead, an optional meta line and actions (`PageHead`), and a section head is a hairline, an h2 and an optional "Wszystkie … →" link.

## 5. Components

Built in this order, each with its states (default, hover, focus, active, disabled, loading, error, empty) and tested with axe and keyboard:

1. Skip link, header with utility bar, navigation (desktop and mobile), breadcrumbs, footer
2. Accessibility settings and theme switch
3. Teraz w szkole (live status), Co przed nami (event board)
4. News card, programme card, document row, person row, contact card, announcement banner
5. Content blocks: rich text, documents, people, timeline, FAQ (disclosure), table, video facade, map facade, call to action
6. Listing with filters and pagination, search box and results
7. Forms: field, select, checkbox, radio, file, error summary, success state
8. Gallery grid and lightbox
9. Staff panel: a shell with a grouped side menu on wide screens (Treści strony, Uczniowie i rodzice, Administracja, by role) and a Menu button on narrow ones; a page head with one primary action; buttons (primary, secondary, danger, quiet), field and select (label above, hint below, 44 px, `--line-strong` border), field group card, disclosure with a chevron, list row (mono date, title, status badge, actions), status badge, empty state with a next step, and notices. The panel uses the site's tokens and type; no system-styled control remains. The primary panel button is a blue fill, because it is a control rather than decoration; status badges are outlined in the status colour on `--surface`.

## 6. Responsive and quality checks

- Mobile first. Layouts are verified at 360, 768, 1280 and 1920 px, in both themes, with 200% text zoom and with every accessibility setting.
- Every component and template has a Playwright test: axe with zero violations, keyboard reachability, no console errors, no horizontal scroll at 360 px.
- Lighthouse budgets: Performance ≥ 95, Accessibility 100, Best Practices 100, CLS ≤ 0.02, total JavaScript per page ≤ 30 KB compressed outside the panel.
- Before a template is merged, screenshots at the four widths in both themes are reviewed against section 2.
