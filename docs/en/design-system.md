# Design system

How the website looks, reads and behaves. The rules here are binding for every page and component. The site plan is in [site-plan.md](site-plan.md).

## 1. Character

ZSM3 is a technical school: cars, aircraft, robots, code. Its students build and repair machines; its partners include an airport ground-handling company. The website should feel like a well-made technical object: precise, legible, honest about materials, and proud of the work done in the workshops. It should not feel like a startup landing page or a template.

Three directions are prototyped in stage 1 on the real home page, a programme page and the documents page. The school chooses one; elements of the others can be borrowed.

| Direction                 | Idea                                                                                                                                                                                                  | Risk                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A. Rysunek techniczny** | the language of engineering drawings: warm paper and ink, hairlines, a modular grid, dimension lines as dividers, a title-block footer, monospaced labels for metadata (dates, rooms, document codes) | can feel cold; needs strong photography to stay warm |
| **B. Tablica odlotów**    | airport wayfinding: high-contrast signage typography, a signal colour on dark, departure-board patterns for events and the live lesson status                                                         | can turn into a gimmick if applied to every page     |
| **C. Warsztat**           | the workshop: large documentary photos of real students at work, a bold condensed headline face, safety-orange accents, generous whitespace                                                           | depends entirely on photo quality and consents       |

Recommended starting point: **A as the base system with B for the live elements** (Teraz w szkole, Co przed nami). It suits a document-heavy public institution and gives the live features a voice of their own.

## 2. Rules against generic design

Every review checks these. Each one is a yes/no question.

**Layout and composition**

1. No centred hero with a headline, a sub-headline and two buttons over a gradient or a blurred photo.
2. No default grid of identical cards with an icon, a title and two lines of text. Cards exist only where items are truly parallel (programmes, news), and then they show real content (photo, date, qualification codes).
3. An asymmetric editorial grid with a clear reading order; alignment to the grid, not to the centre.
4. Whitespace is used to group, never to pad out thin content.

**Colour and surface**

5. No gradients on backgrounds or text, no glow, no glassmorphism, no drop shadows used as decoration. Elevation appears only where an element actually floats (menus, dialogs).
6. Colour only through tokens; the brand navy and one signal colour carry meaning (action, live state), everything else is neutral.
7. One small radius scale (0, 2, 4 px). Nothing is a pill unless it is a status tag.

**Typography**

8. No Inter, Poppins, Montserrat, Space Grotesk or Geist. Typefaces are chosen for this school and must render Polish diacritics perfectly (test string: `Zażółć gęślą jaźń ŹŻĆŃĄŚŁĘÓ`).
9. A typographic scale with real contrast between levels; at most two families plus one monospace.
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

17. Motion explains a change (opening, moving, updating); nothing moves on its own except live data. Durations up to 200 ms, one easing curve, and nothing at all with `prefers-reduced-motion`.
18. No parallax, no scroll-jacking, no auto-rotating carousels, no counters that animate from zero.

**Substance**

19. Every element on a page answers a real question of one of the audiences in the site plan. If removing it loses no information, it is removed.
20. Every claim is checkable: numbers have a source and a date.

## 3. Tokens

All colours, sizes, spacing, radii, durations and z-indices are CSS custom properties in `apps/web/src/styles/tokens.css`. Stylelint rejects colour literals anywhere else.

| Group  | Tokens                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour | `--bg`, `--surface`, `--ink`, `--ink-2`, `--line`, `--brand`, `--signal`, `--success`, `--warning`, `--danger`, `--focus`, each defined for light and dark |
| Type   | `--font-display`, `--font-body`, `--font-mono`, `--step--1` … `--step-5` (fluid `clamp()` scale), `--leading-*`                                            |
| Space  | `--space-1` … `--space-8` on a 4 px base                                                                                                                   |
| Layout | `--measure` (65ch), `--grid-columns`, `--gutter`, `--page-max`                                                                                             |
| Shape  | `--radius-0`, `--radius-1`, `--radius-2`, `--hairline`                                                                                                     |
| Motion | `--ease`, `--duration-1`, `--duration-2`                                                                                                                   |

Contrast: body text at least 7:1 (AAA) in both themes, large text and UI elements at least 4.5:1. The accessibility settings (larger text, high contrast, greyscale, underlined links, readable font) are token overrides, not separate styles.

## 4. Typography candidates

Fonts are self-hosted WOFF2, subset to Latin and Latin Extended, at most two weights per family preloaded.

| Role    | Candidates (open licences)                                | Note                                                                     |
| ------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Display | Barlow Condensed, Archivo Narrow, IBM Plex Sans Condensed | Barlow is the school's current typeface and was drawn after road signage |
| Body    | Atkinson Hyperlegible Next, Source Sans 3, IBM Plex Sans  | Atkinson is designed for low-vision readers                              |
| Mono    | IBM Plex Mono, JetBrains Mono                             | labels, times, codes                                                     |

Final pairs are chosen with the direction, after rendering the Polish test string at every size.

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

## 6. Responsive and quality checks

- Mobile first. Layouts are verified at 360, 768, 1280 and 1920 px, in both themes, with 200% text zoom and with every accessibility setting.
- Every component and template has a Playwright test: axe with zero violations, keyboard reachability, no console errors, no horizontal scroll at 360 px.
- Lighthouse budgets: Performance ≥ 95, Accessibility 100, Best Practices 100, CLS ≤ 0.02, total JavaScript per page ≤ 30 KB compressed outside the panel.
- Before a template is merged, screenshots at the four widths in both themes are reviewed against section 2.
