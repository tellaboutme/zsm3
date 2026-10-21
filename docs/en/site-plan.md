# Website plan

This plan defines what the new public website and panel must do, how the content is organised, and the order of work. It is based on an inventory of the current WordPress site taken on 2026-10-21. Design rules live in [design-system.md](design-system.md); the content-management decision is recorded in [ADR 0001](adr/0001-content-managed-in-panel.md).

## 1. Principles

1. **No lost functionality.** Every feature, page and document of the current site has a place in the new one (section 4). Anything dropped is dropped on purpose, with a reason and the school's approval.
2. **Staff stay in control of content.** Everything the school edits in WordPress today stays editable in the panel, without help from a developer.
3. **Old links keep working.** Every current URL redirects (301) to its new address, so links in PDFs, Librus messages and search engines do not break.
4. **Real school, real content.** Real photos, real numbers, real names and dates. No stock photos, no generated images, no filler copy.
5. **Accessible and fast by default.** WCAG 2.1 AA, zero axe violations, Lighthouse budgets enforced in CI.

## 2. Audiences and top tasks

| Audience                       | Top tasks                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Candidates (age 14–15)         | compare programmes, see workshops and partners, recruitment dates and documents, open days, virtual tour |
| Parents of candidates          | recruitment rules, safety, results and prospects, contact                                                |
| Students                       | bell schedule and current lesson, document templates, e-wniosek, materials, textbooks, job offers, clubs |
| Parents of students            | parent–teacher meetings by class, class teachers, contacts, Librus, rada rodziców, statutes              |
| Staff                          | publish news and announcements, update pages and documents, handle requests, gallery, short links        |
| Public bodies, partners, press | BIP, public procurement, rentals, GDPR information, accessibility statement, projects (Erasmus+, CKZ)    |

## 3. Information architecture

### 3.1 Navigation

The current menu has 9 sections and 180 links, organised by the school's internal structure. The new navigation is organised by audience, with a full sitemap page and search as a safety net.

| Main navigation | Contents                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kandydaci       | Rekrutacja, Kierunki (technikum, branżowa I and II stopnia, kursy zawodowe), Dni otwarte, Szkoła w obiektywie, Wirtualny spacer, Prezentacja szkoły             |
| Uczniowie       | Dzwonki, Wzory dokumentów, E-wniosek, Materiały, Podręczniki, Plany nauczania, Wychowawcy, Samorząd, Koła i kluby, Oferty pracy, Strefa kursów, Bursa           |
| Rodzice         | Wywiadówki, Wychowawcy, Kierownictwo, Rada Rodziców, Informacje, Wzory dokumentów, Statuty                                                                      |
| Szkoła          | O szkole, Historia, Patron, Kadra, Struktura, Terminarz, Pomoc (pedagog, pedagog specjalny, psycholog, pielęgniarka, stomatolog), Biblioteka, Projekty, Galeria |
| Aktualności     | news with categories and archive                                                                                                                                |
| Kontakt         | contact cards, map, secretariat hours                                                                                                                           |

Utility bar: Librus, BIP, E-wniosek, Skrzynka #OgarniamŻycie, search, accessibility settings, theme.

Footer: Statuty, Standardy ochrony małoletnich, RODO and privacy policy, monitoring, Deklaracja dostępności, Zamówienia publiczne, Wynajem, Konkursy and olympiads, sitemap, partners.

### 3.2 Page templates

| Template      | Used for                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Home          | live school status, recruitment (seasonal), news, upcoming events, programmes, partners                   |
| Programme     | every kierunek: what you learn, qualifications, workshops, partners, career paths, related news           |
| Article       | news post with optional gallery and documents                                                             |
| Listing       | news, job offers, projects, competitions, with filters and pagination                                     |
| Content page  | block-based page for everything else (rich text, documents, people, timeline, FAQ, contact cards, tables) |
| Documents     | grouped downloadable files with type, size and date                                                       |
| People        | staff, class teachers, leadership, grouped                                                                |
| Calendar      | school-year calendar with filters, exam and day-off markers, export to `.ics`                             |
| Bell schedule | full schedule, current lesson, shortened-lessons mode                                                     |
| Gallery       | years → albums → photos with an accessible lightbox                                                       |
| Form          | e-wniosek, Skrzynka                                                                                       |
| Utility       | search, sitemap, 404, accessibility statement                                                             |

## 4. Feature parity

Inventory of the current site and where each feature lives in the new one.

### 4.1 Global

| Current feature                                                                              | New site                                                                                                                  | Stage |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| Main menu (180 links)                                                                        | audience navigation, full sitemap page, managed in the panel                                                              | 2     |
| WordPress search                                                                             | full-text search over pages, news and documents (D1 FTS5), Polish diacritics folded                                       | 2     |
| Accessibility widget (Pojo: text size, contrast, greyscale, underlined links, readable font) | built-in accessibility settings with the same options, remembered per browser                                             | 1     |
| Light theme only                                                                             | light and dark theme following the system, with a switch                                                                  | 1     |
| Cookie banner (WPConsent)                                                                    | not needed: no non-essential cookies or trackers (Prawo komunikacji elektronicznej art. 399)                              | 1     |
| Google Analytics (Universal Analytics, shut down by Google in 2023, collects nothing)        | Cloudflare Web Analytics: cookieless, aggregated, no consent needed                                                       | 6     |
| Live visitor counter and admin blocking (zsm3-live-visitors)                                 | visitor statistics in Cloudflare Web Analytics; blocking through Cloudflare WAF rules                                     | 6     |
| Country blocking (IP2Location)                                                               | Cloudflare WAF custom rule                                                                                                | 7     |
| Pop-up announcements (zsm3-popup-manager)                                                    | announcement banner managed in the panel: start and end date, severity, optional link; a dialog only for critical notices | 3     |
| Day-off notice (zsm3-dayoff)                                                                 | day-off entries in the calendar drive the live status and the home banner                                                 | 3     |
| RSS feed                                                                                     | RSS feed for news                                                                                                         | 2     |
| Facebook page plugin                                                                         | Facebook link plus a click-to-load preview; nothing loads from Facebook before the click                                  | 1     |
| YouTube embeds                                                                               | click-to-load facade on `youtube-nocookie.com`                                                                            | 1     |
| Google Maps embed                                                                            | static map image with a link to Google Maps and OpenStreetMap; interactive map on click                                   | 1     |
| Partner and link banners (Kraków, BIP, LS Airport Services, virtual tour)                    | partners section and footer links, managed in the panel                                                                   | 3     |
| All current URLs                                                                             | 301 redirects from every crawled URL, managed in the panel                                                                | 2     |

### 4.2 Home page

| Current feature                                                     | New site                                                                                           | Stage |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- |
| Smart Slider carousel                                               | featured items without auto-rotation (rotating carousels fail WCAG 2.2.2 and are rarely seen)      | 1     |
| Live lesson widget: current lesson, countdown to the bell, progress | "Teraz w szkole": lesson or break, countdown, progress, next bell; works offline from the schedule | 1     |
| Shortened-lessons mode (zsm3-skrocone-lekcje)                       | schedule variants (normal, shortened) selected per day in the panel                                | 3     |
| News list and recent-posts slider                                   | latest news grid with categories                                                                   | 1     |
| "Co przed nami?" upcoming events                                    | upcoming events board from the calendar                                                            | 1     |
| Programme banners (12 kierunki)                                     | programmes section with real workshop photos                                                       | 1     |
| Quick contact (e-mails)                                             | contact strip in the footer                                                                        | 1     |

### 4.3 Sections and pages

| Section          | Current pages and features                                                                                                                                                                                                                                   | New site                                                                                   | Stage |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----- |
| Oferta           | Rekrutacja (14 PDFs: informators, class lists, application, GDPR form), school presentation PDF, 10 technikum, 3 branżowa I, 2 branżowa II, 3 courses, video presentations, virtual tour                                                                     | Kandydaci section; Programme template; Documents block; video facades                      | 2     |
| Szkoła           | structure, staff (grouped by subject), school-year calendar (PDFs), pedagogue, special pedagogue, psychologist, library (hours, Librus e-Biblio, digital libraries), nurse, dentist, child protection standards (10 PDFs), accessibility statement, statutes | Szkoła section; People and Calendar templates; Documents block                             | 2     |
| Uczniowie        | class teachers, student council, clubs (tourism, e-sport, history), entrepreneurship club with competition archives (≈30 subpages), bells, textbooks, curricula, materials, job offers (current and archive, PDFs), course zone, boarding house link         | Uczniowie section; Listing for job offers and competitions; archives kept as content pages | 2     |
| Rodzice          | leadership, staff, class teachers, parents' council, information, parent–teacher meetings by class (room, teacher), templates, statutes                                                                                                                      | Rodzice section; meetings as a structured table per class                                  | 2     |
| Galeria          | 13 school years, about 300 albums and 5,400 photos                                                                                                                                                                                                           | Gallery with archive import                                                                | 5     |
| Projekty         | Erasmus+ (2014–2027, per-year and per-city pages, accreditation), CKZ (3 editions), Małopolska Chmura Edukacyjna, PURWM, StartYourFuture, Złap oddech w górach, Start-Up, Wędrówka po świecie zawodów, Rajd po fach                                          | Projects listing with per-project pages and year subpages                                  | 2     |
| Kontakt          | secretariats, accounting, parents' council, leadership, map                                                                                                                                                                                                  | Kontakt page with structured contact cards                                                 | 2     |
| Historia         | school history, patron                                                                                                                                                                                                                                       | Historia and Patron pages (timeline block)                                                 | 2     |
| Więcej           | programme guide, rentals (PDFs, announcements), GDPR (information, monitoring, recruitment, privacy policy), public procurement (announcements, ≥ 130,000 PLN), competitions, olympiads (IT, mechatronics)                                                   | footer pages and Documents blocks                                                          | 2     |
| Wzory dokumentów | duplicate certificate and student ID requests, PE and second-language exemptions (10 PDFs)                                                                                                                                                                   | Documents page, plus E-wniosek for documents the secretariat issues                        | 2, 4  |
| News             | dated posts with categories and photos                                                                                                                                                                                                                       | Article template, archive by year and category                                             | 2     |

### 4.4 Standalone tools

| Current tool                                                                                                                   | New site                                                                                                                                                                                                                                                        | Stage |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Skrzynka #OgarniamŻycie: anonymous questions to the pedagogue, psychologist and leadership, published anonymously with answers | moderated anonymous Q&A in the panel: nothing is published before a staff member answers; Turnstile and rate limits; no IP stored; crisis numbers (116 111) always visible; a safeguarding workflow agreed with the school under the child protection standards | 6     |
| ZSM URL shortener (password-protected PHP)                                                                                     | short links `/s/<code>` created by staff in the panel; HTTPS targets only; click counts; expiry                                                                                                                                                                 | 6     |

## 5. Content management

The panel (behind Cloudflare Access) gets editors for every content type the school maintains today:

| Content type                              | Fields and behaviour                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| News                                      | title, date, category, cover photo with alt text, rich text, documents, link to an album, draft and scheduled publishing  |
| Pages                                     | place in the navigation, blocks: rich text, documents, people, contact cards, timeline, FAQ, table, video, call to action |
| Documents                                 | upload to R2, title, category, date; PDF accessibility checklist shown on upload                                          |
| Calendar                                  | events with date range, type (exam, holiday, meeting, day off), audience                                                  |
| Bell schedule                             | schedule variants and which variant applies on which days                                                                 |
| Announcements                             | banner text, severity, link, start and end                                                                                |
| Job offers                                | employer, position, PDF, valid until; moved to the archive automatically                                                  |
| Programmes                                | structured programme pages                                                                                                |
| People                                    | staff directory, groups, class teachers, meetings per class                                                               |
| Navigation, redirects, partners           | menus, old-URL redirects, partner logos                                                                                   |
| Short links, Skrzynka, gallery, e-wniosek | as described above                                                                                                        |

The rich-text editor stores structured documents (not raw HTML); the server renders them through an allow-list, so editors cannot inject scripts. Every change goes to the audit log, and pages keep a revision history.

A short Polish editor's guide (`docs/pl/podrecznik-redaktora.md`) is written together with the panel.

## 6. Signature features

These carry real information and give the site its own character:

- **Teraz w szkole:** the current lesson or break, a countdown to the next bell, the active schedule variant and day-off notices, computed in the browser from the published schedule in `Europe/Warsaw` time.
- **Co przed nami:** upcoming events as a compact board, read like a departures board.
- **Kierunki:** each programme shows the real workshop, equipment, partners (for example LS Airport Services) and the qualifications earned.

## 7. Stages

| #   | Stage                 | Outcome                                                                                                                                                        |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Foundation            | done                                                                                                                                                           |
| 1   | Design system         | three visual directions prototyped on real content, one chosen with the school; tokens, typography, components, templates, accessibility settings, live status |
| 2   | Content platform      | D1 content model, import of the current site, hybrid rendering, search, RSS, sitemap, redirects                                                                |
| 3   | Panel and CMS         | Access, roles, editors for every content type, revisions, audit log, editor's guide                                                                            |
| 4   | E-wniosek             | document requests as specified in the architecture                                                                                                             |
| 5   | Gallery               | uploads, public gallery, archive import                                                                                                                        |
| 6   | Community tools       | short links, Skrzynka, cookieless analytics                                                                                                                    |
| 7   | Compliance and launch | accessibility statement, ETR/PJM, PDF accessibility review, terms, full security review, DNS cutover with redirects, staff training                            |

## 8. Open questions for the school

1. Which content editors exist today and who edits what (roles for the panel).
2. Photo consents: which archive photos may be republished.
3. Whether Skrzynka #OgarniamŻycie continues and who moderates it.
4. Which old pages (for example finished competitions from 2018) should stay public as archives.
5. Ukrainian or English information pages for foreign families, if wanted.
