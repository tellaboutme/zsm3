# ZSM3 — System architecture (v1)

Status: **approved draft, stage 0 implemented.** Later stages start once the school answers the open questions in section 15. Polish version: [../pl/architektura.md](../pl/architektura.md).

## 1. Goals and scope

**In v1**

1. Public website: a new Astro front end; the design shell is built ahead of time and pages with editable content are rendered on demand from D1.
2. **E-wniosek:** online requests for school documents such as a student ID renewal or duplicate (_legitymacja szkolna_) or a certificate of attendance (_zaświadczenie o uczęszczaniu do szkoły_). The applicant follows the status through a secret link and needs no account.
3. **Staff panel:** the secretariat handles requests, teachers manage the gallery, an administrator manages access.
4. **Gallery:** albums per school year, photo upload from the panel, migration of the existing archive (304 albums, about 5,400 photos).

**Content management:** everything the school edits today (news, pages, documents, calendar, announcements, bell schedules, job offers) is edited in the panel; see [ADR 0001](adr/0001-content-managed-in-panel.md) and the [site plan](site-plan.md).

**Out of v1:** online payments, accounts for students or parents, replacing the BIP.

**Non-functional requirements**

- Running cost of 0 PLN per month on free plans.
- Compliance with GDPR (RODO), the Polish digital accessibility act (WCAG 2.1 AA) and OWASP ASVS 5.0 level 2.
- No pipeline step is ever skipped: a change that fails any check does not reach `main`.

## 2. Legal requirements → design decisions

| Act                                        | Requirement                                                        | Decision                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GDPR art. 5, 25                            | data minimisation, privacy by design                               | only the fields needed to issue the document; no PESEL, no photos, no IP addresses; field-level encryption (§8.3)                                                                                                                        |
| GDPR art. 6                                | lawful basis                                                       | art. 6(1)(c)/(e) (the school's public task), **not consent**; confirmed by the school's data protection officer (IOD)                                                                                                                    |
| GDPR art. 13                               | information notice                                                 | notice text from the IOD below the form with a link to the full version; an "I have read it" checkbox, which is not consent                                                                                                              |
| GDPR art. 17, 21                           | erasure                                                            | the applicant withdraws a request themselves (§7.3); automatic deletion after the retention period (§8.4)                                                                                                                                |
| GDPR art. 28                               | data processing agreements                                         | the Cloudflare and Brevo accounts **belong to the school**, which accepts their DPAs; a developer with access to production data signs a _umowa powierzenia_ with the school                                                             |
| GDPR art. 30, 32, 33                       | records of processing, security, breaches                          | processing description for the school's register (`docs/RODO.md`), measures from §8, a 72-hour incident procedure (§12.3)                                                                                                                |
| GDPR art. 44+                              | transfers outside the EEA                                          | D1 and R2 in the `eu` jurisdiction; Cloudflare and Brevo under DPA/SCC; Brevo is a French company                                                                                                                                        |
| Ustawa o dostępności cyfrowej (2019)       | WCAG 2.1 AA, accessibility statement                               | zero axe violations on every page in CI; `/deklaracja-dostepnosci` page in the official format, linked from the footer                                                                                                                   |
| Ustawa o zapewnianiu dostępności (2019)    | information about the school in machine-readable text, PJM and ETR | `/dostepnosc` page with an easy-to-read text and a Polish Sign Language video, both provided by the school                                                                                                                               |
| Prawo komunikacji elektronicznej, art. 399 | cookies and browser storage                                        | strictly necessary only: theme choice in `localStorage` (requested by the user), the Access session cookie for staff; no trackers, and Cloudflare Web Analytics (when enabled, §8.2) stores nothing in the browser, so no consent banner |
| UŚUDE art. 8                               | terms of an electronic service                                     | `/e-wniosek/regulamin` page, text approved by the school                                                                                                                                                                                 |
| Copyright act art. 81                      | images of people                                                   | every gallery upload confirms that a permission or agreed legal basis exists and is written to the audit log, which does not itself prove consent; photos can be removed within minutes on request                                       |
| KRI regulation (2024)                      | security and accessibility of public-sector systems                | sections 8, 10 and 12 of this document and the audit log                                                                                                                                                                                 |
| Ustawa o dostępie do informacji publicznej | BIP                                                                | the website does not replace the BIP; links to the BIP in the header and footer                                                                                                                                                          |

## 3. Overview

```
                        ┌──────────────── Cloudflare (school's account) ─────────────────┐
 Visitor ───HTTPS───►   │  WAF (free managed rules) → Worker "zsm3"                       │
                        │     ├─ Static assets: HTML, CSS, JS, fonts, images              │
                        │     ├─ /api/requests/*   public request API (Turnstile, limits) │
                        │     ├─ /api/gallery/*    gallery reads (edge cache)             │
                        │     ├─ /media/*          photos from R2 (published, no store)  │
 Staff ─────Access──►   │     ├─ /panel/*          static panel pages                     │
 (SSO / one-time code)  │     └─ /api/panel/*      panel API (Access JWT, roles, Origin)  │
                        │  D1 (eu)  — requests, gallery, staff, audit log                 │
                        │  R2 (eu)  — gallery photos                                      │
                        │  Queues   — outgoing e-mail (retries, dead-letter queue)        │
                        │  Cron     — retention and clean-up                              │
                        └─────────────────────────────────────────┬──────────────────────┘
                                                                  └──► Brevo (EU) e-mail
```

One Worker on one origin: no CORS, one deployment, one header policy. Cloudflare serves built assets without running any code; the Worker renders content pages from D1 (cached at the edge) and handles `/api/*`, `/media/*` and `/panel*`.

## 4. Stack

| Layer             | Choice                               | Why                                                                                                                                                                              |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime           | Cloudflare Workers + Static Assets   | free, serverless, one origin                                                                                                                                                     |
| Server language   | TypeScript 6.0 (strict)              | native language of Workers; typescript-eslint does not support 7.x yet; Python Workers are still limited in packages and cold starts                                             |
| HTTP              | Hono                                 | small, well-tested router for Workers; middleware for secure headers, body limits and CSRF                                                                                       |
| Validation        | Zod 4                                | one set of schemas for the form and the API (`packages/contracts`)                                                                                                               |
| Database          | D1 (SQLite), SQL migrations          | free; prepared statements with `bind` only                                                                                                                                       |
| Files             | R2                                   | 10 GB free, free egress                                                                                                                                                          |
| JWT               | `jose`                               | verifies Access JWTs against JWKS                                                                                                                                                |
| E-mail            | Brevo behind an `EmailSender` port   | EU provider, 300 e-mails a day free; one adapter to swap the provider                                                                                                            |
| Front end         | Astro 7 (hybrid), TypeScript         | design shell built ahead of time, content pages rendered on demand and cached; JavaScript only where needed; `astro check`; no inline scripts or styles, so the CSP stays strict |
| Image compression | jSquash (WebP, WASM) in a Web Worker | identical output in every browser; Safari cannot encode WebP through canvas                                                                                                      |
| Tooling           | Python 3.13 (`tools/`, uv)           | maintenance scripts: gallery archive import, repository checks                                                                                                                   |
| Node.js           | Node 24 LTS, pnpm 12                 | `minimumReleaseAge` of 7 days, `trustPolicy: no-downgrade`, `allowBuilds`, `blockExoticSubdeps`                                                                                  |

## 5. Repository layout

```
zsm3/
├─ apps/
│  ├─ worker/                     API library, storage, migrations, seed data
│  │  ├─ src/
│  │  │  ├─ index.ts              entry point: fetch, queue, scheduled
│  │  │  ├─ app.ts                Hono application and middleware order
│  │  │  ├─ env.ts                binding and secret types, configuration parsed at start-up
│  │  │  ├─ http/                 problem+json (RFC 9457), headers, request id
│  │  │  ├─ security/             access-jwt, turnstile, rate-limit, origin, pii-crypto, tokens
│  │  │  ├─ domain/               request-lifecycle (state machine), request-types, retention-policy
│  │  │  ├─ storage/              requests-repo, gallery-repo, staff-repo, audit-repo
│  │  │  ├─ media/                webp-inspector, media-keys
│  │  │  ├─ routes/               public-requests, gallery, media, panel/{requests,gallery,staff}
│  │  │  ├─ mail/                 email-sender, brevo-sender, templates, queue-consumer
│  │  │  └─ jobs/                 retention
│  │  ├─ migrations/              0001_content.sql, …
│  │  ├─ seed/                    sample content for local runs and end-to-end tests
│  │  ├─ test/                    unit, integration (workerd), security
│  │  └─ wrangler.jsonc           test Worker only
│  └─ web/
│     ├─ worker/index.ts          deployed entry: /api/* to Hono, everything else to Astro
│     ├─ wrangler.jsonc           deployment configuration
│     ├─ src/middleware.ts        security headers for pages rendered on demand
│     ├─ src/server/              D1 access for pages rendered on demand
│     ├─ src/pages/               Astro pages, including /panel
│     ├─ src/layouts/             page layouts
│     ├─ src/scripts/             TS: site/*, panel/*, upload-worker.ts
│     ├─ src/styles/              tokens.css, global.css
│     ├─ src/content/             site content (news, programmes, timetable)
│     └─ public/                  fonts, images, robots.txt, _headers, .well-known/security.txt
├─ packages/
│  ├─ contracts/                  Zod schemas, DTO types, document types, statuses
│  └─ lint-rules/                 ESLint and Stylelint rules of this repository
├─ tools/                         Python package zsm3_tools: no_comments, import_gallery
├─ e2e/                           Playwright, axe and Lighthouse budgets
├─ docs/                          en/, pl/, RODO.md, RUNBOOK.md, ADR/
└─ .github/                       workflows, composite setup action, Dependabot, zizmor
```

Gallery photos live in R2 (§7.6), never in the repository.

## 6. Data model (D1)

Timestamps are stored in UTC (`TEXT`, ISO 8601) and shown in `Europe/Warsaw`. Identifiers are UUIDv7. `PRAGMA foreign_keys = ON`; every query has an index for its filter.

```
requests
  id                TEXT PK
  type              TEXT NOT NULL            from contracts: STUDENT_ID_RENEWAL | STUDENT_ID_DUPLICATE | ENROLLMENT_CERTIFICATE | …
  status            TEXT NOT NULL            submitted | in_progress | ready | collected | rejected | withdrawn
  pii_ciphertext    BLOB                     AES-256-GCM of {firstName, lastName, className|graduationYear, email, note}; NULL once erased
  pii_key_id        TEXT                     NULL together with pii_ciphertext
  email_index       BLOB                     HMAC-SHA256 of the normalised e-mail, for the open-request limit; NULL once erased
  pii_erased_at     TEXT
  CHECK ((pii_ciphertext IS NULL) = (pii_erased_at IS NOT NULL))
  status_token_hash BLOB NOT NULL UNIQUE     SHA-256 of the status-link token
  staff_note        TEXT                     staff only, no personal data
  created_at, updated_at, closed_at TEXT
  INDEX (status, created_at), INDEX (email_index, status), INDEX (closed_at)

albums
  id, school_year (TEXT '2025/2026'), slug, title, description,
  published_at NULL, deleted_at NULL, created_by, created_at, updated_at
  UNIQUE (school_year, slug) WHERE deleted_at IS NULL

photos
  id, album_id FK, position, width, height, alt, sha256 UNIQUE, consent_by, consent_at,
  deleted_at NULL, created_by, created_at
  INDEX (album_id, deleted_at, position)

photo_uploads
  sha256 PK, started_at, claimed_at NULL
  INDEX (started_at), partial INDEX (claimed_at, sha256)

staff
  email PK (lower case), role (admin | secretariat | editor | gallery_editor), active, created_at, updated_at

audit_log
  id, at, actor_email, action, entity, entity_id, details_json (no applicant personal data)
  INDEX (at)

outbox_failures
  id, message_kind, request_id, error_code, at   messages that reached the dead-letter queue
```

Content tables (`migrations/0001_content.sql`), validated on the way in and out by the Zod schemas in `packages/contracts/src/content.ts`:

```
news
  id TEXT PK (UUIDv7), slug, published_on (YYYY-MM-DD), year (generated from published_on),
  category, title, lead, body_json (structured rich text, never HTML), cover_caption NULL,
  cover_credit NULL, status (draft | published), created_at, updated_at
  UNIQUE (year, slug), INDEX (status, published_on DESC), INDEX (status, category, published_on DESC)

events
  id, starts_on, ends_on NULL (> starts_on), title, audience (Wszyscy | Uczniowie | Rodzice),
  kind (rok-szkolny | przerwa | wolne | zebranie | uroczystosc | oceny | egzamin | praktyki),
  note NULL, key_date (0 | 1), created_at, updated_at
  INDEX (starts_on)

pages
  path PK (/section/page), kicker, title, intro, sections_json (blocks), status, created_at, updated_at

redirects
  from_path PK (old WordPress address, lower case, no trailing slash), to_path, created_at

announcements
  id TEXT PK (UUIDv7), severity (info | important | urgent), text, link_label NULL, link_href NULL,
  starts_on, ends_on (>= starts_on, both inclusive), created_at, updated_at
  INDEX (ends_on, starts_on)

bell_schedule
  id = 1, data_json (regular lessons, named variants, days that use a variant), updated_at
short_links
  code PK              7 characters from 2-9 a-k m n p-z, so 0/1/l/o are never read wrongly
  target_url           https only, validated by the contract schema; '' for a file link
  password_salt BLOB   16 random bytes; NULL together with password_hash
  password_hash BLOB   HMAC-SHA256(SHORT_LINK_KEY, base64url(salt):password)
  created_by           the staff member who made the link
  created_at, expires_at TEXT, revoked_at NULL, clicks INTEGER
  CHECK ((password_hash IS NULL) = (password_salt IS NULL)), CHECK (expires_at > created_at)
  INDEX (expires_at), INDEX (created_by, created_at)

questions (Skrzynka #OgarniamŻycie, see skrzynka.md)
  id PK (random UUIDv4), addressee, status (received | draft | published | rejected | withdrawn),
  version, question_ciphertext NULL, draft_ciphertext NULL (AES-GCM, PII keys),
  public_slug UNIQUE NULL, published_question / published_answer / published_on (only while published),
  form_key UNIQUE, received_on (day only), changed_at NULL
short_link_files
  object_key PK        s/<uuidv7>, made by the Worker; never derived from the upload
  code UNIQUE NULL     the link it belongs to; NULL while the upload is in progress
  name, format, bytes  cleaned display name, format detected from the content, size
  created_by, created_at, removed_at NULL (set once the R2 object is deleted)
  INDEX (removed_at, created_at)
short_link_failures
  id INTEGER PK, code TEXT, attempted_at INTEGER (milliseconds); nothing about the visitor
  INDEX (code, attempted_at), INDEX (attempted_at)
```

A short link expires at the exclusive instant `1 September 00:00 Europe/Warsaw` that ends the school year in which it was made (`shortLinkExpiry` in `@zsm3/contracts/short-link-expiry`); the Warsaw date and offset come from `Intl` with an explicit time zone, never from the host. Links issued under the earlier day-count contract keep the expiry stored with them.

Repositories in `apps/worker/src/storage` take a `Store` (`db`, `clock`, `random`), use static SQL with `.bind()` only, and parse every row with a schema. They run against real SQLite (`node:sqlite`) in the Node tests, where coverage and mutation testing run, and against D1 in the workerd tests.

### Rendering

`@astrojs/cloudflare` builds the site into `apps/web/dist/client` (prerendered pages and assets) and `apps/web/dist/server` (the Worker). The Worker entry `apps/web/worker/index.ts` sends `/api/*` to the Hono application from `@zsm3/worker/app` and every other request to Astro's handler, which serves a prerendered file when one exists and otherwise renders the page from D1.

Rendered on demand: every page of the site except the error page and the pattern library, because each page carries the active announcement, the published bell schedule and the events of the current school year (header menu, home timeline, calendar), and the search results endpoint `/szukaj/wyniki.json`. The page middleware reads them once per page request (`src/server/site-state.ts`) and passes them to the layout through `Astro.locals`; the layout prints the banner and puts the schedule in `data-bells` on `<body>`, where the live status reads it, falling back to the regular schedule built into the script. The search endpoint queries the `search_documents` FTS5 table (unicode61 tokenizer, folded text in the indexed `title` and `body`, bm25 ranking) through the search repository and alternates those matches with statically scored entries, reserving discovery space for programmes and events even when FTS is full. A D1 match replaces stale static content at the same URL; distinct calendar dates remain separate. The old static `/szukaj/indeks.json` endpoint remains until the follow-up contract PR. Unknown categories, years, pages and articles return 404 with the prerendered error page. Before such a 404 reaches the visitor, the Worker checks the `redirects` table for public GET and HEAD requests and answers with a permanent redirect when the resolved target is an existing page; chains are followed up to eight hops and any lookup failure falls back to the original 404. Astro middleware gives these responses the same headers as `_headers` gives static files, computed from the same module. Pages read D1 only through the repositories and the structural `SqlDatabase` interface; `src/cloudflare-workers.d.ts` exposes nothing else to Astro code. Pages are not cached at the edge; see [ADR 0003](adr/0003-no-edge-cache-for-pages.md).

Content pages (`/szkola/historia`, and top-level pages such as `/rodo`) are read from the `pages` table; the site map and the search index include every published page.

### Documents and other files

School documents (forms, statutes, curricula, recruitment files) live in R2 under `d/<sha256>.<format>` and are served at `/media/d/...` by the Hono app. A file is served only if the `files` table knows its key; the response carries the stored content type, `Content-Disposition` (inline for PDF and images, attachment for archives and office files), `nosniff`, `Cross-Origin-Resource-Policy: same-origin` and `Cache-Control: public, max-age=31536000, immutable`, which is safe because the key is the content hash. Pages link to files through `files` blocks; nothing on the site links to the previous website.

Static assets are not configured with `not_found_handling`: with it, Cloudflare answers browser navigations from the asset 404 page before the Worker runs.

Migrations follow expand/contract: the new code works with the old schema and vice versa. They run before the Worker is deployed. Apply all pending D1 migrations before deploying search: `0003_search_index_backfill.sql` sorts after `0003_search_index.sql` and before the stage 4 `0004_requests.sql`, indexing published news and pages already in D1 even where the index migration was applied earlier. It leaves documents indexed by subsequent saves unchanged. Do not deploy the search endpoint against a database stopped at `0003_search_index.sql`.

## 7. Flows

### 7.1 Submitting a request

1. The `/e-wniosek` page gets the document types and their fields at build time from `contracts`; there is no runtime configuration request.
2. `POST /api/requests`, an `application/json` body of at most 8 KB:
   1. `Content-Type` and size check;
   2. rate limit keyed by HMAC(IP, secret), 5 requests per 10 minutes; the IP address is never stored;
   3. Turnstile `siteverify`: `success`, `hostname`, `action = "request"`, `challenge_ts` at most 300 s old, `idempotency_key`;
   4. bot trap: a hidden field must stay empty and the form must take at least 3 s to fill in;
   5. `contracts.RequestInput.strict()`, a discriminated union on `type`: NFC normalisation, trimming, length limits, class from a fixed list;
   6. at most 3 open requests per `email_index`;
   7. encryption of personal data, token generation, `INSERT`;
   8. two e-mails are queued: to the applicant (status link) and to the secretariat (number and type only, **no personal data**).
3. The response is `201` with the status link; the page suggests saving it, and the same link arrives by e-mail.

### 7.2 Checking the status

- Link format: `https://<domain>/e-wniosek/status#<token>`. The token is 32 random bytes in base64url and lives **in the URL fragment**, so it never reaches logs, `Referer` headers or proxy histories.
- The page sends `POST /api/requests/status {token}` (rate limited). The response holds the type, status, last change and collection message, and no personal data.

### 7.3 Withdrawing a request

`POST /api/requests/withdraw {token}` sets `withdrawn` and erases the personal data immediately; an anonymous record remains for statistics.

### 7.4 Panel: requests

- `/panel/*` and `/api/panel/*` sit behind a Cloudflare Access application. Staff sign in with the school's Microsoft 365 or Google Workspace (SSO with MFA) if available, otherwise with a one-time code sent to an allow-listed e-mail address. Sessions last 8 hours.
- The Worker **itself** verifies `Cf-Access-Jwt-Assertion`: signature against the team JWKS, `aud`, `iss`, `exp`, `nbf`. Without a valid JWT the answer is 401, even if a request somehow bypassed Access. The `workers.dev` domain and preview URLs are disabled.
- The role comes from an active `staff` row. The access matrix is one table in code, and a test covers every route.
- The staff API for requests lives at `/api/panel/requests`: `GET /requests` (filtered list, newest first, at most 50 per page, no personal data; the next page is requested with `before` and `beforeId` from `nextBefore` and `nextBeforeId`, so requests created in the same millisecond are not skipped), `GET /requests/:id` (personal fields for `admin` and `secretariat` only, `null` once retention erased the PII) and `POST /requests/:id/status` (body `{ to, expectedStatus }`; a transition checked against the stored status, which must equal `expectedStatus`, with the audit row, the `ready`/`rejected` e-mail and the status update in one D1 batch, each conditioned on that same stored status, so either all of them apply or none does and a stale attempt answers `409`; staff cannot set `submitted` or `withdrawn`, which stays the applicant's erasing action).
- Staff handle requests at `/panel/wnioski` ([panel.md](panel.md#handling-requests)): personal data only in the detail view, transition buttons from the shared lifecycle table, and every transition carries the status the staff member saw, so a decision taken on an outdated view is refused with `409`.
- State-changing requests require `Origin` equal to the site and `Content-Type: application/json` (CSRF protection).
- The `domain/request-lifecycle` state machine enforces the transitions
  `submitted → in_progress → ready → collected`, and `rejected` from any open state. The applicant is e-mailed on `ready` and `rejected`.
- Every change is written to `audit_log`.
- **Documents are handed over in person only, after an ID check at the secretariat.** The online request is only a pre-request, so a request filed in someone else's name gives an attacker nothing.

### 7.5 Panel: gallery

1. An editor creates an album (school year, title, description) and drops in photos.
2. A Web Worker in the browser decodes each file (`createImageBitmap`, EXIF orientation), produces two sizes, 400 and 1600 px on the long edge, and encodes them to WebP with jSquash. Re-encoding drops EXIF and GPS data.
3. Photos upload one at a time: `POST /api/panel/albums/:id/photos`, a multipart body with both files, each at most 1.5 MB, plus the mandatory confirmation that the school holds a permission, or another legal basis it has agreed, to publish the image. The checkbox and its audit entry record who confirmed this and when; they are not proof of consent, which stays with the school.
4. The server **does not trust the client**:
   - it parses RIFF/WebP and accepts only `VP8 `, `VP8L`, `VP8X` and `ALPH` chunks; `EXIF`, `XMP `, `ANIM`, `ICCP` and anything unknown are rejected;
   - it allows only the layouts `VP8 `, `VP8L`, `VP8X` + `VP8 `/`VP8L`, and `VP8X` + `ALPH` + `VP8 `, and requires the RIFF size, chunk sizes, padding and canvas to agree with the file;
   - it checks the dimensions in the header: the large variant is at most 1600 px on the long edge, the small one exactly 400 px, and both have the same proportions (±1 px);
   - it computes SHA-256 of the large variant; the R2 keys are derived as `g/<sha256>-s.webp` and `g/<sha256>-l.webp`, so no user input reaches a key and the keys are not stored;
   - a repeated upload is recognised by `sha256`: in the same album it answers `200` with `duplicate: true` and changes nothing, a photo live in another album answers `409`, and a soft-deleted photo, or one in a deleted album, comes back with the new album, alt text and consent.
5. R2 is written before D1, so a failed D1 batch leaves unreachable objects but never a row without a file. The media route serves only what `photos` lists. Every R2 write and removal goes through the journal in `photo_uploads`, so nothing has to guess what a key in R2 belongs to:
   - an upload takes a five-minute lease on its hash before anything else. While the lease runs, or while cleanup holds a claim, another upload of the same hash answers `409`. A second upload therefore cannot replace the first one's thumbnail, and it looks at `photos` only after it holds the lease, so it also sees a photo that has just been saved. A crashed or failed upload holds the lease until it expires, and the same file can then be sent again;
   - the D1 batch that saves the photo removes the journal row, so a crash at any point leaves the row behind;
   - every Cron tick (`jobs/photo-cleanup.ts`), rows older than 24 hours whose hash has a row in `photos`, soft-deleted included, are dropped without touching R2. `photos.sha256` is unique, so this keeps files in use by another record safe;
   - the remaining old rows are claimed in one statement that rechecks `photos`, then both variants are deleted and the row removed, at most 50 per tick. A failed R2 delete keeps the claim and retries on the next tick.
6. An album is public only after "Opublikuj", which needs at least one photo. Every photo has its own recorded confirmation, so a published album never contains an unconfirmed one. Both `admin` and `gallery_editor` can publish and unpublish. Deleting the last photo of a published album unpublishes it in the same batch, so an urgent removal is never refused. Triggers on `albums` and `photos` hold these limits in the database, whatever order concurrent requests commit in: an album without photos cannot become published, and an album cannot exceed 1000 live photos through an insert or a restore.
7. Deletion is soft (`deleted_at`) and ends access immediately, including when the school withdraws permission: the media route checks D1 on every request, and §7.6 limits how long a cached copy can last. After 30 days the same job turns the photo row into a claimed journal row in one batch, skipping any hash an upload holds, then removes the files with the same retries and records `photos.purge` in the audit log. A deleted album is treated the same way, and its row goes once no photo refers to it.

### 7.6 Public gallery and media

- Pages: `/szkola/galeria` (years), `/szkola/galeria/<yyyy-yyyy>` (albums), `/szkola/galeria/<yyyy-yyyy>/<slug>` (photos and the lightbox). A year or gallery with nothing published shows an empty state marked `noindex` and stays out of the sitemap.
- `GET /api/gallery/years`, `/api/gallery/years/:year/albums`, `/api/gallery/albums/:id` return published albums only, cached for 60 seconds (`public, max-age=60`) with no `stale-while-revalidate`.
- `GET /media/g/<sha256>-(s|l).webp` checks `photos` in D1 on every request (album published, photo not deleted), then streams the object from R2 with `Content-Type: image/webp`, `nosniff`, `Cache-Control: no-store` and `Cross-Origin-Resource-Policy: same-origin`.
- Photos are not cached by the Worker, the Cache API or the browser. A school can withdraw permission to publish a student's photo, and a stored copy cannot be recalled, so deleting a photo or album, or unpublishing an album, ends delivery at the next request. The album pages and the JSON above can still list it for up to 60 seconds in a browser, but its files already answer 404. Caching photos is a later optimisation that needs agreed requirements first.
- **Archive import** by `tools/import_gallery.py`: downloads from the current site (at most 4 parallel connections), Pillow (EXIF rotation, metadata removal, WebP 400/1600), upload to R2 over the S3 API, SQL for D1. The script is idempotent and resumes where it stopped. No real archive is imported or published until the school has named who is responsible for it.

### 7.7 Opening a short link

1. `GET /s/<code>` is rendered on demand by Astro. The code is lower-cased and trimmed, so a code read out loud and typed in capitals still resolves.
2. A link that is unknown or malformed answers 404, one that expired or was revoked answers 410, both as a page in the site's own design rather than a problem document.
3. A link without a password redirects (302) to its target and counts the click.
4. A link with a password renders a form. The form posts to `POST /api/short-links/<code>` in the Worker, because the Astro middleware refuses every method other than GET. The route accepts the submission when the `Origin` equals the site or the browser reports `Sec-Fetch-Site: same-origin`, a header a script cannot set; the site sends `Referrer-Policy: no-referrer`, under which a form navigation carries `Origin: null`, so the origin alone would refuse the one path that works without JavaScript. With a form body it then answers 303 — to the target when the password matches, otherwise back to the page with an error flag in the query, so a refresh never resubmits the password.
5. Guesses are limited to 30 per link per 10 minutes through `rate_limits`, keyed by SHA-256 of the code, and wrong passwords to 100 per link in any rolling 24 hours through `short_link_failures`, one row per attempt holding only the code and the time. After the 10-minute check, one statement inserts a row only while fewer than 100 rows for the code are at most 24 hours old (`attempted_at >= now - 24 h`), so concurrent requests on D1 can never take a 101st slot and no fixed window lets a second hundred in at its edge; a failure stops counting 24 hours and 1 ms after it happened. The slot is taken before the password is checked: a link with no slot left answers `?blad=doba` even to the right password and gives no answer to test against, and a right password gives its slot back. Only wrong passwords keep a slot: a correct one, an empty form, a throttled attempt, an open link and a download never do, and a correct password does not clear older failures, so a teacher's own unlock cannot refill a guesser's budget. The 10-minute counter is consumed before every check; a right password gives back only its own attempt, and only within the window that attempt was counted in, so earlier wrong guesses stay counted and a class opening the link together is never throttled. Both limits are per link rather than per visitor: nothing derived from an address is stored, and a distributed guesser gains nothing. The cost is that someone who sends 100 wrong passwords locks the link for everyone until the day ends; the teacher can then share a new link. New passwords need at least 12 characters (`MIN_PASSWORD_LENGTH`); passwords set before the change keep working, because only creation checks the length.
6. A link to a file never redirects. The page shows a download button for an open file and the password form for a protected one, without naming the file. Both forms post to the same `POST /api/short-links/<code>`, which runs the checks above and then streams the R2 object itself with `Content-Disposition: attachment`, the content type of the detected format, `Cache-Control: private, no-store` and the API security headers. There is no URL for the object: `/media` serves only `d/` keys listed in `files`, and private objects live under `s/`.

### 7.8 Panel: short links

- Staff with a content role create links at `/panel/linki`: `POST /api/panel/short-links` with `{ target, password? }`, or `POST /api/panel/short-links/files` with a multipart body (`file`, optional `password`) of at most 20 MB plus form overhead. The list (`GET /short-links`) and revocation (`DELETE /short-links/:code`) stay limited to the author's own links; no response carries a password, salt, digest or object key. Only the `admin` role may list every active link (`GET /short-links/all`: code, author, page or file, dates, whether a password is set; no destination, file name or object key) and revoke any of them (`DELETE /short-links/all/:code`), for example the links of a teacher who has left; that revocation is audited as `short_link.admin_revoke` with the administrator as the actor and the author in the details. Every creation and revocation writes `audit_log` in the same D1 batch, and a revocation that changes nothing writes nothing.
- An upload is accepted by its content, not its name or declared type: a PDF signature, an OOXML container with its main part (DOCX, XLSX, PPTX), or an ODF container whose stored `mimetype` names the format (ODT, ODS, ODP). The archive is read from its central directory only, never decompressed; an archive that does not begin with a local file header, a directory that does not end the file exactly, spans disks, uses ZIP64 or lists more than 5000 entries is refused, and so is any VBA project, ActiveX part, Excel 4.0 macro sheet (`macrosheets/`), embedded OLE object (`embeddings/oleObject*.bin`, which covers packaged programs and legacy Equation 3.0 objects; embedded Office documents such as a chart's workbook are kept) or ODF `Basic/` and `Scripts/` folder. This is a structural check, not malware scanning: PDF JavaScript, actions and embedded files, ODF embedded objects, external template or link references and parser exploits pass unless the container rule above refuses them. Downloads are always `Content-Disposition: attachment` with the detected format's `Content-Type`, `X-Content-Type-Options: nosniff` and a `default-src 'none'` CSP, so nothing renders or runs under the site's origin; what remains is the risk of opening a document from a signed-in staff member in a desktop application. The file extension must match the detected format. ZIP and other archives are not accepted.
- The Worker first records the upload in `short_link_files` with no code, then writes the R2 object under a new `s/<uuidv7>` key, then inserts the link, attaches the file and writes the audit row in one batch that changes nothing unless the pending row still exists. When R2 or D1 fails, the Worker deletes the object and the pending row; if that also fails, the sweep below finds the pending row after an hour.
- Housekeeping runs before, and independently of, the e-wniosek outbox and retention, which need the e-wniosek secrets. Each step (rate limits, failed passwords, lapsed links, private files) runs even when another fails; a failure is logged as `housekeeping_step_failed` with the step and error name only, and the scheduled run then fails, so it stays visible. Every step is idempotent. The scheduled job (every 15 minutes, together with the rate-limit, lapsed-link and failed-password pruning; failed-password rows go once more than 24 hours old, 1000 per run) deletes the R2 object of every file whose link was revoked, has expired, has been pruned, or never finished uploading within an hour, 50 per run, marks the row removed, and forgets removed rows whose link is gone. Each upload has its own object, so deleting one never affects another link, and a new link never takes a code that a file row still holds.

### 7.9 Social and search metadata

- `Base.astro` renders canonical URL, `robots`, Open Graph (`og:type`, `og:title`, `og:description`, `og:url`, `og:locale`) and Twitter (`summary_large_image` with title, description and image) for every public page.
- The shared card is `apps/web/public/og-default.png`, a 1200×630 file. `SOCIAL_IMAGE` in `apps/web/src/lib/seo.ts` is the single source of the path, size and alt text, so the layout and the audit test cannot drift apart.
- Regenerate the card with `python og_image/generate.py` from `tools/` (needs Pillow and `pnpm install` for the font files); the output is byte-stable for a given script and font set.
- `apps/web/test/seo-metadata.test.ts` walks `apps/web/src/pages`, reads each `<Base>` call and fails when an indexable page passes an empty literal title or description or repeats one that another page already uses. Pages that opt out through `noindex`, the panel, `/wzornik`, `/s` and `/e-wniosek` are excluded.
- A committed change to public content (a news item or page becoming public, changing while public, or being withdrawn) submits its public address to IndexNow after the response, through `waitUntil`, once the `INDEXNOW_HOST` variable is set; without it nothing is sent. The key is public and served at `/<key>.txt` (see [panel.md](panel.md) and [supply-chain.md](supply-chain.md)). `robots.txt` stays closed until stage 7.

## 8. Security

### 8.1 Threat model

| Threat                    | Mitigation                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form spam and bots        | Turnstile, rate limiting, bot trap, open-request limit, WAF                                                                                          |
| XSS                       | CSP without `unsafe-inline`, Trusted Types (`require-trusted-types-for 'script'`), `innerHTML` banned by lint (`no-unsanitized`), DOM APIs only      |
| SQL injection             | `prepare().bind()` only; a lint rule bans template strings inside `prepare`                                                                          |
| CSRF in the panel         | `Origin` check, JSON only, Access cookie with `SameSite=Lax`                                                                                         |
| Access bypass             | own JWT verification, `workers.dev` and preview URLs disabled                                                                                        |
| Privilege escalation      | roles from the database, access matrix, a test for every route × role pair                                                                           |
| Status-token guessing     | 256 bits of entropy, rate limiting, only the hash is stored                                                                                          |
| Malicious file            | own WebP parser, chunk allow-list, size limits, content-addressed keys                                                                               |
| Database or backup leak   | field-level encryption of personal data, key only in Worker secrets                                                                                  |
| Leak through logs         | a structured logger that accepts only typed events without personal data                                                                             |
| Supply chain              | lockfiles, 7-day minimum release age, provenance checks, audit and OSV, actions pinned by SHA, zizmor, SBOM (see [supply-chain.md](supply-chain.md)) |
| Secrets in the repository | gitleaks over the full history in CI, GitHub secret scanning and push protection; `.dev.vars` ignored                                                |
| Clickjacking              | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                                                                                    |
| E-mail provider outage    | queue with retries and a dead-letter queue; the request is stored regardless                                                                         |

### 8.2 HTTP headers (everywhere)

`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, a strict `Content-Security-Policy` (Turnstile and `youtube-nocookie.com` only where used), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` with every feature off, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`. Static files get them from `_headers`, Worker responses from middleware; tests check the full set. Target: A+ on Mozilla Observatory.

Cloudflare Web Analytics is off until the public site token is set in `CF_BEACON_TOKEN` (32 lower-case hex characters; anything else keeps it off). Then pages rendered by the Worker load `https://static.cloudflareinsights.com/beacon.min.js`, and only their CSP adds that origin to `script-src` and `https://cloudflareinsights.com` to `connect-src`; prerendered pages (404, panel) keep the policy without them. The beacon sets no cookie and no storage, the school sees aggregated counts only, and the privacy policy switches to the paragraph that names the tool. The script is served with `Cross-Origin-Resource-Policy: cross-origin` and CORS, so `require-corp` stays, and it works under `require-trusted-types-for 'script'`. Its URL is not versioned, so it cannot carry an integrity hash; this is the one external script the site accepts on that basis.

The gallery upload page in the panel is the only exception to the site-wide CSP, for the image Worker in §7.5. `renderHeaders` gives two paths their own policy: `/panel/galeria/album` and `/_astro/photo-worker-*`, because a Worker obeys the CSP of its own script response, not the page's. That policy adds `worker-src 'self'`, `'wasm-unsafe-eval'` and one Trusted Types policy, `zsm3-photo-worker`, which accepts only the Worker's own URL; `new Worker` is a Trusted Types sink, so without it the page could not start the Worker. `blob:` is not used. General `unsafe-eval`, `unsafe-inline` and any relaxation for the rest of the site are not allowed. A test in `e2e/tests/panel.gallery.spec.ts` encodes a real photo under this policy and checks the rest of the panel keeps the strict one.

### 8.3 Cryptography

- A request's personal data is one JSON document encrypted with AES-256-GCM (WebCrypto), a random 96-bit IV per record and `request.id` as AAD. The key `PII_KEY_<id>` is a Worker secret; `pii_key_id` in each row allows key rotation without downtime.
- `email_index` is HMAC-SHA256 with a separate `EMAIL_INDEX_KEY`.
- Status tokens come from `crypto.getRandomValues`; only their SHA-256 is stored.
- A short link's password is stored as HMAC-SHA256 of `base64url(salt):password` under the `SHORT_LINK_KEY` Worker secret, with 16 random salt bytes per row. A slow KDF would be the usual choice, but 200k PBKDF2 iterations cost far more than the 10 ms of CPU a request gets on the Workers free plan; keying the digest with a secret that never reaches D1 protects a stolen database instead, which is what these passwords are worth. Link codes come from `crypto.getRandomValues` and 32 divides 256, so the alphabet is drawn without bias.
- The panel decrypts personal data only for the request or list page being viewed; searching by surname happens in the browser on the loaded page.

### 8.4 Retention (defaults, approved by the IOD)

| Data                                           | Retention                                              |
| ---------------------------------------------- | ------------------------------------------------------ |
| Personal data of a closed request              | 30 days after closing                                  |
| Personal data of a withdrawn request           | erased immediately                                     |
| Open request without activity                  | 90 days, then `rejected` with an e-mail, then as above |
| Anonymous request record (type, dates, status) | 2 years, for statistics                                |
| `audit_log`                                    | 2 years                                                |
| Worker logs                                    | Cloudflare's retention (a few days), no personal data  |
| Deleted photos                                 | 30 days in R2, then physically removed                 |
| Files of an abandoned photo upload             | 24 hours in R2, then physically removed                |
| Expired or revoked short links                 | 30 days after they stop working, then the row is gone  |
| Skrzynka question without a decision           | 90 days after it was received                          |
| Skrzynka question rejected or withdrawn        | 30 days after the decision                             |
| Original text of a published Skrzynka question | erased at publication                                  |
| Files behind short links                       | deleted from R2 within 15 minutes of the link stopping |

A daily Cron job enforces retention and records every run in `audit_log`. That job deletes `audit_log` rows older than two years in batches of 100 (`RETENTION_BATCH`), at most 10 batches per tick (`RETENTION_BATCHES_PER_RUN`), so a backlog drains across ticks instead of one long query; the `audit_log_at` index serves the cutoff predicate. The daily `cron_state` guard applies the request retention and the audit prune at most once per UTC day, and a remaining backlog resumes on the next tick without marking the day as done.

## 9. Privacy in the interface

- The form collects only the document type, first name, surname, class or graduation year, e-mail and an optional note of up to 500 characters, whose hint says "nie wpisuj danych wrażliwych" (do not enter sensitive data).
- Below the form: the information notice, the terms and an "I have read it" checkbox.
- No unnecessary third parties: self-hosted fonts, the map as a link, YouTube behind a click-to-load facade on `youtube-nocookie.com`.

## 10. Accessibility

- WCAG 2.1 AA: axe runs in Playwright on every page and every form state (errors, success) with zero violations allowed.
- Forms: a `label` for every field, errors linked with `aria-describedby`, focus moves to the first error, messages in `aria-live`, no time limits. If the Turnstile challenge cannot be completed, the page offers the secretariat's phone number and address.
- Everything works with the keyboard, including photo upload and the lightbox.
- Accessibility modes from the current site (larger text, high contrast, greyscale, underlined links) are kept.
- `/deklaracja-dostepnosci` and `/dostepnosc` (easy-to-read text, Polish Sign Language).

## 11. Code quality

### 11.1 Rules

- No comments in code: names and structure carry the intent. Enforced by the `local/no-comments` rule for TypeScript, Astro and CSS and by `zsm3-no-comments` for Python. The only exception is a `#!` line in executable scripts.
- No `any`, no unchecked `as`, no `!`, no `@ts-ignore`, `# type: ignore` or `noqa`; lint rules cannot be disabled inline.
- External data (requests, database rows, Turnstile answers, JWTs, environment) is parsed by a schema at the boundary; inside, only types are used.
- Domain errors are typed values (`Result`); exceptions are for truly exceptional cases. Error responses are `application/problem+json` without stack traces.
- Time, randomness and identifiers are injected (`Clock`, `Random`), so tests are deterministic.
- No global mutable state; the domain layer is pure and knows nothing of Hono, D1 or R2.
- Exhaustive `switch` over unions (`never`); no floating promises.
- Files up to ~200 lines, functions up to ~40; cyclomatic complexity is capped by lint.
- Conventional Commits; `main` only changes through pull requests with every check green.

### 11.2 Tools

| Area       | Tool                                       | Settings                                                                                                                                               |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TS types   | `tsc`, `astro check`, `wrangler types`     | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax` |
| TS lint    | ESLint + typescript-eslint                 | `strictTypeChecked`, `stylisticTypeChecked`, `no-unsanitized`, `regexp`, `import-x`, `jsx-a11y`, `local/no-comments`, `--max-warnings 0`               |
| Formatting | Prettier, `ruff format`                    | checked in CI and in pre-commit hooks                                                                                                                  |
| CSS        | Stylelint                                  | `stylelint-config-standard`, colours only through tokens, `local/no-comments`                                                                          |
| Python     | ruff (`select = ["ALL"]`), mypy `--strict` | only rules that conflict with the no-comments policy (`D`) or the formatter are off                                                                    |
| Workflows  | actionlint, zizmor, ShellCheck             | zizmor requires every action to be pinned by hash                                                                                                      |
| Secrets    | gitleaks                                   | full history in CI                                                                                                                                     |
| HTML, SQL  | html-validate, sqlfluff                    | added together with the first panel pages and migrations (stage 1)                                                                                     |

### 11.3 Tests

| Level                     | Tool                                                                                                       | Threshold                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Server unit + integration | Vitest, run in Node and in workerd (`@cloudflare/vitest-pool-workers`, real D1, R2, Queues)                | 100% lines and branches                                             |
| Properties                | fast-check (schemas, WebP parser, cryptography, state machine)                                             | required for these modules                                          |
| Security                  | access matrix, forged and expired JWTs, wrong `aud`, CSRF, size limits, WebP fuzzing, SQL and XSS payloads | every route                                                         |
| Mutation                  | Stryker                                                                                                    | mutation score ≥ 90%                                                |
| Front-end logic           | Vitest + happy-dom                                                                                         | 100% of logic                                                       |
| End-to-end                | Playwright: Chromium, Firefox, WebKit, mobile; Turnstile test keys                                         | every user flow                                                     |
| Accessibility             | `@axe-core/playwright`                                                                                     | zero violations                                                     |
| Performance               | Lighthouse 13 inside Playwright (Chromium)                                                                 | Performance ≥ 95, Accessibility 100, Best Practices 100, CLS ≤ 0.02 |
| Python                    | pytest + hypothesis, network mocked                                                                        | 100% lines and branches                                             |

## 12. CI/CD and operations

### 12.1 Pipeline (GitHub Actions)

```
PR ─► install (frozen lockfiles) ─► format · lint · types · no-comments
    ─► unit/integration + coverage ─► mutation tests ─► build ─► e2e + axe + Lighthouse (wrangler dev)
    ─► security: pnpm audit, OSV-Scanner (npm + uv), Semgrep (OWASP), CodeQL, gitleaks, actionlint,
                 ShellCheck, zizmor, dependency review, OWASP ZAP baseline, SBOM (CycloneDX)
main ─► preview deployment (separate Worker/D1/R2, test data) ─► ZAP baseline against preview
     ─► manual approval (GitHub environment "production") ─► D1 migrations ─► deployment
nightly ─► ZAP full scan against preview, dependency checks
```

Every workflow starts from `permissions: {}`; actions are pinned by SHA and images by digest. The Cloudflare deployment token is limited to Workers Scripts, D1 and R2 of one account. Deployment jobs are added once the school's Cloudflare account exists.

### 12.2 Environments and secrets

|           | local                    | preview                    | production          |
| --------- | ------------------------ | -------------------------- | ------------------- |
| Data      | Miniflare, fixtures      | fake                       | real                |
| Access    | localhost                | whole domain behind Access | panel behind Access |
| Turnstile | test keys                | test keys                  | production keys     |
| Secrets   | `.dev.vars` (not in git) | `wrangler secret`          | `wrangler secret`   |

The Worker parses its configuration with a schema at start-up; without a required secret it serves nothing but 503.

### 12.3 Operations

- **Backups:** D1 Time Travel (point-in-time restore) plus a weekly `wrangler d1 export` from GitHub Actions into a private R2 bucket kept for 8 weeks. Personal data in the export is already encrypted at field level.
- **Monitoring:** Workers Logs, Cloudflare error notifications, an e-mail to the administrator for dead-letter messages.
- **Kill switch:** `REQUESTS_ENABLED=false` closes the request form with one deployment and shows the secretariat's contact details instead.
- **Personal data incident** (`docs/RUNBOOK.md`): disable forms → rotate keys and the deployment token → inform the IOD immediately → the IOD decides on notifying UODO within 72 hours.
- `/.well-known/security.txt` (RFC 9116) with a contact for vulnerability reports.

## 13. Cost

| Resource                 | Free tier                                                    | Expected load                |
| ------------------------ | ------------------------------------------------------------ | ---------------------------- |
| Workers                  | 100,000 requests a day; static assets are free and uncounted | hundreds of API calls a day  |
| D1                       | 5 GB, 5 million reads and 100,000 writes a day               | megabytes                    |
| R2                       | 10 GB, 1 million writes and 10 million reads a month         | archive ~2–3 GB compressed   |
| Queues                   | included in the Workers free plan                            | a few e-mails a day          |
| Access                   | 50 users                                                     | secretariat and teachers     |
| Turnstile, free WAF, DNS | free                                                         |                              |
| Brevo                    | 300 e-mails a day                                            | a few a day                  |
| GitHub Actions           | unlimited for public repositories                            | ~15 minutes per pull request |

Total: **0 PLN per month**. The school already owns its domain. If load grows, Workers Paid costs USD 5 a month.

## 14. Stages

| #   | Stage                 | Outcome                                                                                                                        |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Foundation            | **done:** repository, monorepo, tooling and CI with every check, Worker and Astro skeletons                                    |
| 1   | Design system         | visual direction chosen with the school, tokens, typography, components, templates, accessibility settings, live status        |
| 2   | Content platform      | D1 content model, import of the current site, hybrid rendering, search, RSS, redirects, technical SEO                          |
| 3   | Panel and CMS         | Access, JWT verification, roles, editors for every content type, revisions, audit log, editor's guide                          |
| 4   | E-wniosek             | migrations, request API, form, status, withdrawal, e-mail queue, retention                                                     |
| 5   | Gallery               | upload in the panel, public gallery, media serving, archive import                                                             |
| 6   | Community tools       | short links, Skrzynka #OgarniamŻycie, cookieless analytics                                                                     |
| 7   | Compliance and launch | accessibility statement, ETR/PJM, PDF review, terms, full ZAP scan, ASVS L2, DNS cutover, search engine registration, training |

Details per stage: [site-plan.md](site-plan.md).

A stage is closed only with a green pipeline and a demo on preview.

## 15. Open questions

**For the school (before stage 7; development on preview is not blocked)**

1. Cloudflare and Brevo accounts registered to the school, with the developer added as a member; acceptance of their DPAs.
2. The school's domain DNS moves to Cloudflare (name-server change; e-mail records are kept).
3. IOD: lawful basis, retention periods (§8.4), notice text, entry in the register of processing, decision on a _umowa powierzenia_ with the developer.
4. List of documents, the fields for each, collection rules and fees for duplicates.
5. Whether the school has Microsoft 365 or Google Workspace (SSO with MFA for the panel).
6. Staff list and roles.
7. Policy on consents for publishing students' images.
8. Material for `/dostepnosc` (easy-to-read text, PJM video) and the accessibility coordinator named in the statement.

**To verify when the Cloudflare account exists**

- The `eu` jurisdiction for D1 on the free plan (available for R2).
- The Rate Limiting binding and Queues on the free plan under current terms. If either is missing: limits through D1, e-mail through an outbox table and Cron; the architecture stays the same.
- Turnstile together with Trusted Types (end-to-end test). If they conflict: a Trusted Types policy for the Turnstile domain only.
