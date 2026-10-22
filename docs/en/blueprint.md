# Website blueprint

The complete construction plan of the public website: every page, its address, its sections in order, the components it is built from, and the order of construction. It turns the [site plan](site-plan.md) into buildable units in the chosen visual direction (E, see [ADR 0002](adr/0002-visual-direction-precyzja.md) and the [design system](design-system.md)).

The plan is layered like a building:

| Layer       | What it is                                       | Section |
| ----------- | ------------------------------------------------ | ------- |
| Foundation  | tokens, grid, typography, motion, accessibility  | 1       |
| Frame       | global chrome: header, menus, footer, banners    | 2       |
| Floor plan  | sitemap and URL scheme                           | 3       |
| Rooms       | page templates with their sections in order      | 4       |
| Fittings    | components and their variants                    | 5       |
| Utilities   | live data, search, forms, feeds                  | 6       |
| Build order | milestones of stage 1 and their acceptance tests | 7       |

## 1. Foundation

### 1.1 Grid and breakpoints

- 12-column grid, `--page-max` 86 rem, outer margin `--space-5`, column gap `--space-5`.
- Mobile first. Breakpoints: `40rem` (640 px, two columns), `56rem` (896 px, side columns), `80rem` (1280 px, wide layouts).
- Content measure `--measure` (60 ch) for running text; nothing wider is set in body size.
- Every page uses one of three layouts:

```
FULL                     MAIN + ASIDE                      NARROW
┌──────────────────┐     ┌────────────────┬───────┐       ┌────────────┐
│ section          │     │ main (8 col)   │ aside │       │ main       │
│ section          │     │                │ (4)   │       │ (8 col,    │
│ section          │     │                │ sticky│       │  centred)  │
└──────────────────┘     └────────────────┴───────┘       └────────────┘
home, hubs, listings     programme, article, documents    forms, legal pages
```

### 1.2 Typography

| Role    | Face                               | Use                                                  |
| ------- | ---------------------------------- | ---------------------------------------------------- |
| Display | Archivo, width 112–125, weight 800 | page titles, section titles, numbers, codes          |
| Body    | Source Sans 3, weights 400/600/700 | running text, navigation, forms                      |
| Mono    | IBM Plex Mono 400/500              | tags, dates, times, document and qualification codes |

Scale `--step-n1` … `--step-4`, fluid with `clamp()`. Page titles use `--step-title`, which also scales with the width of `<main>` (a size container), so long Polish words such as „dokumentów” never break mid-word on phones or with large text. Self-hosted WOFF2, Latin and Latin Extended subsets only, two files preloaded (Archivo, Source Sans 3).

### 1.3 Colour

| Token               | Light                 | Dark                  | Use                                                              |
| ------------------- | --------------------- | --------------------- | ---------------------------------------------------------------- |
| `--bg`              | `#ffffff`             | `#0a0f19`             | page                                                             |
| `--gray`            | `#f1f3f6`             | `#121a28`             | tiles, strips, asides                                            |
| `--ink` / `--ink-2` | `#0b1220` / `#48546a` | `#eef2f8` / `#b0bccf` | text, secondary text                                             |
| `--blue`            | `#0b4fb3`             | `#1d4fa8`             | brand surfaces with white text (live status, exams, hover fills) |
| `--link`            | `#0b4fb3`             | `#8fb8f7`             | links and blue text on the page background                       |
| `--orange`          | `#f26b1d`             | `#ff8a3d`             | primary action (Rekrutacja), live progress, focus                |
| `--line`            | `#dfe3ea`             | `#23304a`             | rules and borders                                                |

Blue and orange are the school's logo colours. Orange is never used for small text on a light background (contrast 2.7:1); text uses `--link` or `--ink`.

### 1.4 Motion

| Token          | Value                                 |
| -------------- | ------------------------------------- |
| `--ease`       | `cubic-bezier(0.22, 0.8, 0.24, 1)`    |
| `--duration-1` | 160 ms — hover, focus, small feedback |
| `--duration-2` | 380 ms — fills, image zoom, filters   |
| `--duration-3` | 750 ms — page-title entrance          |

| Pattern         | Where                                          | Rule                                                                    |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Title rise      | page title lines on load                       | once per page, staggered 80 ms                                          |
| Reveal          | section heads, cards, list items on scroll     | CSS scroll-driven animation; without support, content is simply visible |
| Fill            | profession tiles, list rows on hover and focus | blue fills from the bottom                                              |
| Nudge           | arrows in links and buttons                    | 0.3–0.4 rem to the right                                                |
| Zoom            | news photos on hover                           | scale 1.06 inside the frame                                             |
| Page transition | every navigation                               | `@view-transition` cross-fade; the page title morphs                    |
| Live            | Teraz w szkole timer and progress              | updates every second; the only thing that moves by itself               |

Nothing auto-rotates, loops or uses parallax. Content never waits for an animation. With `prefers-reduced-motion: reduce` every animation and transition is off.

### 1.5 Accessibility baseline

Skip link, landmarks (`header`, `nav`, `main`, `aside`, `footer`), one `h1` per page, logical heading order, visible focus (3 px orange outline), targets at least 44 × 44 px on touch, 200% zoom without loss, and the accessibility settings panel (§2.5). Every template ships with a Playwright test: axe with zero violations in both themes, keyboard path through all interactive elements, no horizontal scroll at 360 px.

## 2. Frame (global chrome)

### 2.1 Page shell

```
┌─────────────────────────────────────────────────────────────────┐
│ ANNOUNCEMENT BANNER (only when active, dismissible per session) │
├─────────────────────────────────────────────────────────────────┤
│ HEADER (sticky)                                                 │
│ ZSM3 │ Zespół Szkół…   Kandydaci Uczniowie Rodzice Szkoła       │
│                        Aktualności Kontakt   ⌕  Aa  ◐  [Rekrutacja →] │
├─────────────────────────────────────────────────────────────────┤
│ BREADCRUMBS (all pages except home)                             │
│ PAGE (template)                                                 │
├─────────────────────────────────────────────────────────────────┤
│ FOOTER                                                          │
└─────────────────────────────────────────────────────────────────┘
⌕ search   Aa accessibility settings   ◐ theme
```

### 2.2 Header

- Header breakpoints are container queries on the header, so they follow the text-size setting (`rem` scales with it): desktop navigation from `80rem`, the school name from `48rem` and hidden between `80rem` and `92rem` where the navigation needs the room, search, settings and theme from `40rem`. Nothing may scroll sideways at 360 px with 150% text.
- Left: wordmark `ZSM3` (orange 3) and the full name in two lines; links to home.
- Centre: six audience sections. Desktop (≥ 80 rem): each opens a **mega menu** on click (not on hover), closes on Escape, outside click or focus leaving it.
- Right: search, accessibility settings, theme, and the orange **Rekrutacja** button.
- Mobile: wordmark, Rekrutacja, and a menu button opening a full-height panel with the six sections as disclosures, then utility links (Librus, BIP, E-wniosek, Skrzynka).
- The header shrinks (smaller padding) after 80 px of scroll; no hide-on-scroll.

### 2.3 Mega menu

```
┌──────────────────────────────────────────────────────────────┐
│ UCZNIOWIE                                                    │
│ Na co dzień          Dokumenty           Życie szkoły        │
│ Dzwonki              Wzory dokumentów    Samorząd            │
│ Plan lekcji ↗        E-wniosek           Koła i kluby        │
│ Materiały            Statut              Oferty pracy        │
│ Podręczniki                              Strefa kursów       │
│ Plany nauczania                          Bursa ↗             │
│ ┌ Teraz w szkole: 3. lekcja · do dzwonka 12:41 ┐             │
└──────────────────────────────────────────────────────────────┘
```

Three titled columns per section plus one live or featured item (Teraz w szkole for Uczniowie, the next parent meeting for Rodzice, the recruitment status for Kandydaci). External links carry ↗ and the text "(otwiera nową stronę)" for screen readers only when they open a new tab.

### 2.4 Footer

```
┌───────────────────────────────────────────────────────────────┐
│ ZSM3 wordmark, full name, patron                              │
│ Adres + map link │ Sekretariaty (phones, e-mails, hours)      │
│ Na skróty: Librus, BIP, E-wniosek, Skrzynka, Mapa strony      │
│ Dokumenty: Statut, Standardy ochrony małoletnich, RODO,       │
│ Polityka prywatności, Deklaracja dostępności, Zamówienia      │
│ publiczne, Wynajem, Konkursy                                  │
│ Partners: Gmina Miejska Kraków, LS Airport Services, Erasmus+ │
│ © ZSM3 · organ prowadzący · last content update               │
└───────────────────────────────────────────────────────────────┘
```

### 2.5 Accessibility settings and theme

A dialog (`<dialog>`, focus trapped, Escape closes) with switches: larger text (125%, 150%), high contrast, greyscale, underlined links, readable font (Atkinson Hyperlegible), reduce motion, theme (system, light, dark). Choices are token overrides on `<html>` data attributes, stored in `localStorage`, applied before first paint by an external script in `<head>` whose hash is in the CSP.

### 2.6 Announcement banner

One active banner at a time, managed in the panel: severity (information, important, urgent), text, optional link, start and end. Urgent banners cannot be dismissed. Day-off notices from the calendar use the same banner.

## 3. Floor plan (sitemap and URLs)

Polish, lowercase, hyphenated slugs; no dates in page URLs except news; every old WordPress URL redirects (301).

```
/                                         Home
├─ /kandydaci                             Hub: candidates
│  ├─ /kandydaci/rekrutacja               Recruitment (documents, dates, steps)
│  ├─ /kandydaci/zawody                   Professions listing with field filter
│  │  └─ /kandydaci/zawody/{slug}         Programme (13 + 2 branżowa II)
│  ├─ /kandydaci/kursy-zawodowe           Courses listing
│  │  └─ /kandydaci/kursy-zawodowe/{slug} Course
│  ├─ /kandydaci/dzien-otwarty            Open day (seasonal)
│  └─ /kandydaci/szkola-w-obiektywie      Videos (facades)        + Wirtualny spacer ↗
├─ /uczniowie                             Hub: students
│  ├─ /uczniowie/dzwonki                  Bell schedule (full, live, variants)
│  ├─ /uczniowie/wzory-dokumentow         Documents
│  ├─ /uczniowie/e-wniosek                Request form
│  │  └─ /uczniowie/e-wniosek/status      Request status (token in fragment)
│  ├─ /uczniowie/materialy                Materials
│  ├─ /uczniowie/podreczniki              Textbooks
│  ├─ /uczniowie/plany-nauczania          Curricula
│  ├─ /uczniowie/wychowawcy               Class teachers
│  ├─ /uczniowie/samorzad                 Student council
│  ├─ /uczniowie/kola-i-kluby             Clubs listing
│  │  └─ /uczniowie/kola-i-kluby/{slug}   Club (archives of competitions as subpages)
│  ├─ /uczniowie/oferty-pracy             Job offers (current, archive)
│  └─ /uczniowie/strefa-kursow            Course zone                  + Bursa ↗, Librus ↗
├─ /rodzice                               Hub: parents
│  ├─ /rodzice/wywiadowki                 Parent–teacher meetings by class
│  ├─ /rodzice/rada-rodzicow              Parents' council
│  ├─ /rodzice/informacje                 Information for parents
│  └─ /rodzice/kierownictwo               Leadership
├─ /szkola                                Hub: the school
│  ├─ /szkola/o-szkole                    About
│  ├─ /szkola/historia                    History (timeline)
│  ├─ /szkola/patron                      Patron
│  ├─ /szkola/kadra                       Staff
│  ├─ /szkola/struktura                   Structure
│  ├─ /szkola/terminarz                   School-year calendar (.ics)
│  ├─ /szkola/pomoc                       Help: pedagogue, special pedagogue, psychologist, nurse, dentist
│  ├─ /szkola/biblioteka                  Library
│  ├─ /szkola/projekty                    Projects listing
│  │  └─ /szkola/projekty/{slug}[/{year}] Project (Erasmus+, CKZ, …)
│  ├─ /szkola/galeria                     Gallery: years
│  │  └─ /szkola/galeria/{year}/{album}   Album
│  ├─ /szkola/statut                      Statutes
│  └─ /szkola/standardy-ochrony-maloletnich
├─ /aktualnosci                           News listing (category, year)
│  └─ /aktualnosci/{year}/{slug}          Article
├─ /kontakt                               Contact
├─ /skrzynka                              Anonymous Q&A (#OgarniamŻycie)
├─ /szukaj                                Search
├─ /mapa-strony                           Sitemap
├─ /deklaracja-dostepnosci  /dostepnosc   Accessibility statement, ETR and PJM
├─ /rodo  /polityka-prywatnosci           Data protection
├─ /zamowienia-publiczne  /wynajem  /konkursy
├─ /s/{code}                              Short links (redirect)
└─ /panel/…                               Staff panel (behind Access)
```

## 4. Rooms (page templates)

Each template lists its sections in reading order. "Data" names the content type from the [site plan](site-plan.md) §5.

### 4.1 Home `/`

```
┌───────────────────────────────────────────────────────────────┐
│ kicker: Technikum · Szkoła branżowa      os. Szkolne 37       │
│ ZESPÓŁ SZKÓŁ                                                  │
│ MECHANICZNYCH nr 3                       (title rise)         │
│ ┌─────────────────────────────┐ ┌──────────────────────────┐  │
│ │ featured photo + caption    │ │ TERAZ W SZKOLE  5:58:14  │  │
│ │ (links to its story)        │ │ ▓▓▓▓▓░░░                 │  │
│ │                             │ ├──────────────────────────┤  │
│ │                             │ │ Dzwonki               →  │  │
│ └─────────────────────────────┘ │ Wzory dokumentów      →  │  │
│                                 │ Wywiadówki            →  │  │
│                                 │ Kontakt               →  │  │
│                                 └──────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│ 13 zawodów │ 5 branż │ 5 lat │ Erasmus+          (numbers)    │
├───────────────────────────────────────────────────────────────┤
│ SEASONAL: Rekrutacja 2027/2028 — steps, dates, CTA            │
│ (Feb–Aug; outside: Dzień otwarty or hidden)                   │
├───────────────────────────────────────────────────────────────┤
│ WYBIERZ ZAWÓD  [Wszystkie][Motoryzacja][Lotnictwo]…           │
│ ┌────┐┌────┐┌────┐┌────┐  13 tiles, blue fill on hover        │
├───────────────────────────────────────────────────────────────┤
│ CO SIĘ DZIEJE W SZKOLE   5 latest news          Wszystkie →   │
├───────────────────────────────────────────────────────────────┤
│ CO PRZED NAMI   timeline of the next 5 events  Terminarz →    │
├───────────────────────────────────────────────────────────────┤
│ DLA KANDYDATA │ DLA UCZNIA │ DLA RODZICA   (4 links each)     │
├───────────────────────────────────────────────────────────────┤
│ Partners and projects strip: Erasmus+, CKZ, LS Airport Services │
└───────────────────────────────────────────────────────────────┘
```

Data: featured item (news or curated photo), bell schedule and today's variant, numbers (settings), recruitment season (settings), professions, latest news, upcoming events, audience links, partners.

The seasonal recruitment block is built in stage 2, when the panel provides the recruitment dates; the static stage 1 home never shows invented dates. Upcoming events are rendered at build time and re-filtered in the browser against today's date in `Europe/Warsaw`, so the timeline never shows past events between deployments.

### 4.2 Hub `/kandydaci`, `/uczniowie`, `/rodzice`, `/szkola`

```
┌───────────────────────────────────────────────────────────────┐
│ SECTION TITLE (title rise) + one-sentence intro               │
│ primary action (e.g. Rekrutacja / E-wniosek / Wywiadówki)     │
├───────────────────────────────────────────────────────────────┤
│ live/featured module (Kandydaci: recruitment status;          │
│ Uczniowie: Teraz w szkole; Rodzice: next meeting;             │
│ Szkoła: numbers and history teaser)                           │
├───────────────────────────────────────────────────────────────┤
│ task groups: 3 columns of titled link lists (same as mega menu)│
├───────────────────────────────────────────────────────────────┤
│ news filtered for this audience (3)                           │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Professions listing `/kandydaci/zawody`

Title, intro, field filter (radio group, works without JavaScript), school-type filter (technikum, branżowa I, branżowa II), tiles grid, comparison table toggle (name, school, years, qualifications), link to recruitment. One tile per programme (15). Filtering is pure CSS (`:has()` on the checked radios); JavaScript only announces the result count, shows the empty state and selects the filter named in the URL fragment (`#lotnictwo`, `#technikum`).

### 4.4 Programme `/kandydaci/zawody/{slug}`

```
┌───────────────────────────────────────────────────────────────┐
│ breadcrumbs   INFORMATYKA · TECHNIKUM MECHANICZNE NR 17       │
│ TECHNIK                                                       │
│ PROGRAMISTA                                (title rise)       │
│ 5 lat nauki │ 2 egzaminy │ 7 technologii │ Erasmus+           │
├──────────────────────────────────────────┬────────────────────┤
│ workshop photo or gallery (3)            │ W SKRÓCIE (sticky) │
│ CZEGO SIĘ UCZYSZ  01–06                  │ nauka, egzaminy,   │
│ technologies / equipment tags            │ pytania (phone)    │
│ DWA EGZAMINY, JEDEN TYTUŁ  INF.03 INF.04 │ [Rekrutacja →]     │
│ GDZIE SIĘ UCZYSZ ZAWODU (workshops,      │                    │
│ partners, internships, Erasmus+)         │                    │
│ FAQ (disclosures)                        │                    │
├──────────────────────────────────────────┴────────────────────┤
│ news tagged with this profession (3) │ other professions in field │
└───────────────────────────────────────────────────────────────┘
```

Data: programme (field, school, years, qualifications, areas, technologies, places, photos, FAQ), related news, sibling programmes. The FAQ is generated from the programme data (length, exams, entry requirement, driving licence, Erasmus+), so it never states anything the data does not; related news is added in stage 2 when news carry profession tags.

### 4.5 News listing `/aktualnosci` and article `/aktualnosci/{year}/{slug}`

Listing: title, category filter, year filter, lead story large, then a grid of cards, numbered pagination (no infinite scroll), RSS link. Filters are links to static listings (`/aktualnosci/kategoria/{slug}`, `/aktualnosci/{year}`), pages are `…/strona/{n}` with nine items each, and the current filter and page carry `aria-current`. The RSS feed needs absolute URLs, so it ships in stage 2 with the production domain.

Rich text is a structured document validated by `packages/contracts/src/rich-text.ts` (paragraph, heading 2–3, list, quote, table, video; inline text with bold or italic and links limited to `https://`, site paths, fragments, `mailto:` and `tel:`). Anything else is rejected before rendering, and Astro escapes every string. Videos render as a facade linking to YouTube, so no third-party frame or cookie loads with the page.

Article (narrow layout with wide media):

```
breadcrumbs · category · date
TITLE (title rise)
lead paragraph
cover photo (caption, credit)
rich text body: paragraphs, headings, lists, quotes, tables, video facade
photo strip → full album link
attached documents
copy-link button · previous / next · related news (3)
```

### 4.6 Content page (all block-based pages)

Breadcrumbs, title, intro, optional in-page navigation (for pages with four or more sections), then blocks in any order: rich text, documents, people, contact cards, timeline, FAQ, table, video, map, call to action, callout. Sibling pages listed at the end.

### 4.7 Specialised templates

| Template      | URL                           | Sections                                                                                                                            |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Documents     | `/uczniowie/wzory-dokumentow` | steps (download, fill in, hand in), signer filter, groups of document rows (code, title, who, PDF size and date), e-wniosek callout |
| Bell schedule | `/uczniowie/dzwonki`          | live status (large), today's variant, full table with breaks, variant switch for upcoming shortened days                            |
| Calendar      | `/szkola/terminarz`           | year overview (key dates), filters (audience, type), month groups, `.ics` export, PDF version                                       |
| People        | `/szkola/kadra` and similar   | groups (leadership, subjects), person rows (name, role, subjects), contact through the secretariat                                  |
| Meetings      | `/rodzice/wywiadowki`         | next meeting, table by class (room, teacher), contact note                                                                          |
| Contact       | `/kontakt`                    | contact cards (secretariats, accounting, parents' council, leadership), hours, map facade, how to get there                         |
| Gallery       | `/szkola/galeria/…`           | years → album grid → photo grid with lightbox (keyboard, swipe, Escape)                                                             |
| Form          | e-wniosek, Skrzynka           | narrow layout, error summary, fields, Turnstile, success state with next steps                                                      |
| Utility       | search, sitemap, 404          | search box with results grouped by type; full tree; 404 with search and top tasks                                                   |
| Legal         | accessibility, RODO, etc.     | narrow layout, document metadata (date, version), in-page navigation                                                                |

Stage 1 notes for the everyday templates:

- Hubs show the three latest news until news carry audience tags (stage 2).
- The bell schedule picks today's variant (shortened days) in the browser for the page and the live status everywhere; past variants are hidden.
- The calendar filters are pure CSS like the professions listing; JavaScript hides empty months, announces the count and shows the empty state. `/szkola/terminarz.ics` is generated at build time (RFC 5545: CRLF, escaping, 75-octet folding).
- Meetings and contact fixtures carry rooms, roles, extensions and role mailboxes only; names of staff come from the panel at runtime. Office hours are shown once the school provides them.

Stage 1 notes for the utility pages:

- `/mapa-strony` renders the tree from `data/site-map.ts`; an end-to-end crawl from the home page fails the build when a reachable page is missing from the map. `sitemap.xml` needs absolute URLs and ships in stage 2 with the production domain.
- `/szukaj` searches a static index (`/szukaj/indeks.json`, built from the site map, programmes, news, forms and calendar) in the browser: Polish letters folded, simple suffix stemming, all words required, title matches ranked first, results grouped by type and rendered without `innerHTML`. Stage 2 swaps the index for the D1 FTS5 endpoint behind the same page.
- `/polityka-prywatnosci` uses the legal layout (metadata, in-page navigation) and describes exactly what the public site does; it is marked as a draft until the school's data protection officer approves it.

## 5. Fittings (components)

Every component lives in `apps/web/src/components/`, takes typed props from `packages/contracts`, and has an entry on the pattern page `/wzornik` (built only with `pnpm build:preview`, never in production).

| Group      | Components (variants)                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell      | SkipLink, AnnouncementBanner (info, important, urgent), Header (default, compact), MegaMenu, MobileMenu, Breadcrumbs, Footer                                                              |
| Settings   | AccessibilityDialog, ThemeSwitch                                                                                                                                                          |
| Heroes     | PageTitle (with title rise), HomeHero, HubHero, ProgrammeHero, ArticleHeader                                                                                                              |
| Live       | LiveStatus (panel, compact, large), BellTable                                                                                                                                             |
| Wayfinding | QuickLinks, TaskGroups, AudiencePanels, InPageNav, SiblingNav, Pagination                                                                                                                 |
| Data       | NumbersStrip, ProfessionTile, FieldFilter, ComparisonTable, NewsCard (lead, standard, compact), EventTimeline, EventList, DocumentRow, SignerFilter, PersonRow, ContactCard, MeetingTable |
| Content    | RichText, Figure (caption, credit), PhotoStrip, Gallery, Lightbox, VideoFacade, MapFacade, Callout, FAQ, Table, Timeline, CallToAction                                                    |
| Forms      | Field, TextArea, Select, Checkbox, RadioGroup, FileField, ErrorSummary, SubmitButton, SuccessPanel, Turnstile                                                                             |
| Utility    | SearchBox, SearchResults, StatusPill, CopyLinkButton, ExternalLinkMark                                                                                                                    |

States for every interactive component: default, hover, focus-visible, active, disabled, loading, error, empty.

## 6. Utilities

| Utility     | How it works                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Live status | bell schedule and today's variant rendered into the page; the browser computes the state in `Europe/Warsaw` every second             |
| Search      | D1 FTS5 index of pages, news, documents and programmes; diacritics folded; results grouped by type                                   |
| Feeds       | RSS for news; `.ics` for the calendar                                                                                                |
| Forms       | progressive enhancement: native validation, then server validation with the same Zod schema                                          |
| Images      | responsive `srcset` (400, 800, 1600), AVIF and WebP, explicit dimensions, lazy below the fold                                        |
| Redirects   | table of old URLs → new URLs checked by the Worker before rendering                                                                  |
| SEO         | titles, descriptions, canonical URLs, Open Graph with real photos, `sitemap.xml`, structured data (`School`, `NewsArticle`, `Event`) |

## 7. Build order (stage 1)

Each milestone is one or more pull requests, merged only with every check green.

| #   | Milestone          | Contents                                                                                  | Accepted when                                                          |
| --- | ------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1.1 | Foundation         | tokens, fonts, base styles, grid utilities, motion, lint fixes for Astro, `/wzornik` page | tokens documented; Stylelint rejects literals; pattern page passes axe |
| 1.2 | Frame              | header, mega menu, mobile menu, footer, breadcrumbs, banner, accessibility dialog, theme  | keyboard-only navigation works; dialog traps focus; settings persist   |
| 1.3 | Home               | hero, live status, numbers, profession tiles and filter, news, timeline, audience panels  | matches §4.1 at 360/768/1280/1920 in both themes; Lighthouse budgets   |
| 1.4 | Programme family   | professions listing, programme template                                                   | all 15 programmes render from fixtures                                 |
| 1.5 | News family        | listing, article, rich-text renderer                                                      | rich text allow-list tested; pagination accessible                     |
| 1.6 | Everyday templates | hubs, content page, documents, bells, calendar, people, meetings, contact                 | each template has a fixture page and e2e test                          |
| 1.7 | Utility pages      | search page shell, sitemap, 404, legal layout                                             | sitemap lists every route                                              |
| 1.8 | Visual regression  | Playwright screenshot baselines per template × 4 widths × 2 themes                        | baselines committed; CI fails on unreviewed visual change              |

Fixtures in stage 1 are typed modules generated from the current site's public text. Stage 2 swaps them for D1 without touching components, because components only depend on the `contracts` types.

Fixtures never contain personal data or photos of people: staff and people blocks use roles without names, and images in fixtures and screenshot baselines are plain test placeholders. Real photos and names reach the site only at runtime, from R2 and D1, through the panel.
