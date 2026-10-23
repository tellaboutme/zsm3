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

| Act                                        | Requirement                                                        | Decision                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GDPR art. 5, 25                            | data minimisation, privacy by design                               | only the fields needed to issue the document; no PESEL, no photos, no IP addresses; field-level encryption (§8.3)                                                            |
| GDPR art. 6                                | lawful basis                                                       | art. 6(1)(c)/(e) (the school's public task), **not consent**; confirmed by the school's data protection officer (IOD)                                                        |
| GDPR art. 13                               | information notice                                                 | notice text from the IOD below the form with a link to the full version; an "I have read it" checkbox, which is not consent                                                  |
| GDPR art. 17, 21                           | erasure                                                            | the applicant withdraws a request themselves (§7.3); automatic deletion after the retention period (§8.4)                                                                    |
| GDPR art. 28                               | data processing agreements                                         | the Cloudflare and Brevo accounts **belong to the school**, which accepts their DPAs; a developer with access to production data signs a _umowa powierzenia_ with the school |
| GDPR art. 30, 32, 33                       | records of processing, security, breaches                          | processing description for the school's register (`docs/RODO.md`), measures from §8, a 72-hour incident procedure (§12.3)                                                    |
| GDPR art. 44+                              | transfers outside the EEA                                          | D1 and R2 in the `eu` jurisdiction; Cloudflare and Brevo under DPA/SCC; Brevo is a French company                                                                            |
| Ustawa o dostępności cyfrowej (2019)       | WCAG 2.1 AA, accessibility statement                               | zero axe violations on every page in CI; `/deklaracja-dostepnosci` page in the official format, linked from the footer                                                       |
| Ustawa o zapewnianiu dostępności (2019)    | information about the school in machine-readable text, PJM and ETR | `/dostepnosc` page with an easy-to-read text and a Polish Sign Language video, both provided by the school                                                                   |
| Prawo komunikacji elektronicznej, art. 399 | cookies and browser storage                                        | strictly necessary only: theme choice in `localStorage` (requested by the user), the Access session cookie for staff; no analytics or trackers, so no consent banner         |
| UŚUDE art. 8                               | terms of an electronic service                                     | `/e-wniosek/regulamin` page, text approved by the school                                                                                                                     |
| Copyright act art. 81                      | images of people                                                   | every gallery upload confirms that consents exist and is written to the audit log; photos can be removed within minutes on request                                           |
| KRI regulation (2024)                      | security and accessibility of public-sector systems                | sections 8, 10 and 12 of this document and the audit log                                                                                                                     |
| Ustawa o dostępie do informacji publicznej | BIP                                                                | the website does not replace the BIP; links to the BIP in the header and footer                                                                                              |

## 3. Overview

```
                        ┌──────────────── Cloudflare (school's account) ─────────────────┐
 Visitor ───HTTPS───►   │  WAF (free managed rules) → Worker "zsm3"                       │
                        │     ├─ Static assets: HTML, CSS, JS, fonts, images              │
                        │     ├─ /api/requests/*   public request API (Turnstile, limits) │
                        │     ├─ /api/gallery/*    gallery reads (edge cache)             │
                        │     ├─ /media/*          photos from R2 (cached, immutable)     │
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
  id, school_year (TEXT '2025/2026'), slug UNIQUE(school_year, slug), title, description,
  cover_photo_id NULL, published_at NULL, deleted_at NULL, created_by, created_at, updated_at

photos
  id, album_id FK, position, width, height, alt, key_small, key_large, sha256 UNIQUE,
  deleted_at NULL, created_by, created_at
  INDEX (album_id, position)

staff
  email PK (lower case), role (admin | secretariat | gallery_editor), active, created_at, updated_at

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
```

Repositories in `apps/worker/src/storage` take a `Store` (`db`, `clock`, `random`), use static SQL with `.bind()` only, and parse every row with a schema. They run against real SQLite (`node:sqlite`) in the Node tests, where coverage and mutation testing run, and against D1 in the workerd tests.

### Rendering

`@astrojs/cloudflare` builds the site into `apps/web/dist/client` (prerendered pages and assets) and `apps/web/dist/server` (the Worker). The Worker entry `apps/web/worker/index.ts` sends `/api/*` to the Hono application from `@zsm3/worker/app` and every other request to Astro's handler, which serves a prerendered file when one exists and otherwise renders the page from D1.

Rendered on demand: the home page, the section hubs, every news listing and article, and the search index (until FTS5 replaces it). Unknown categories, years, pages and articles return 404 with the prerendered error page. Astro middleware gives these responses the same headers as `_headers` gives static files, computed from the same module. Pages read D1 only through the repositories and the structural `SqlDatabase` interface; `src/cloudflare-workers.d.ts` exposes nothing else to Astro code.

Content pages (`/szkola/historia`, and top-level pages such as `/rodo`) are read from the `pages` table; the site map and the search index include every published page.

### Documents and other files

School documents (forms, statutes, curricula, recruitment files) live in R2 under `d/<sha256>.<format>` and are served at `/media/d/...` by the Hono app. A file is served only if the `files` table knows its key; the response carries the stored content type, `Content-Disposition` (inline for PDF and images, attachment for archives and office files), `nosniff`, `Cross-Origin-Resource-Policy: same-origin` and `Cache-Control: public, max-age=31536000, immutable`, which is safe because the key is the content hash. Pages link to files through `files` blocks; nothing on the site links to the previous website.

Static assets are not configured with `not_found_handling`: with it, Cloudflare answers browser navigations from the asset 404 page before the Worker runs.

Migrations follow expand/contract: the new code works with the old schema and vice versa. They run before the Worker is deployed.

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
- State-changing requests require `Origin` equal to the site and `Content-Type: application/json` (CSRF protection).
- The `domain/request-lifecycle` state machine enforces the transitions
  `submitted → in_progress → ready → collected`, and `rejected` from any open state. The applicant is e-mailed on `ready` and `rejected`.
- Every change is written to `audit_log`.
- **Documents are handed over in person only, after an ID check at the secretariat.** The online request is only a pre-request, so a request filed in someone else's name gives an attacker nothing.

### 7.5 Panel: gallery

1. An editor creates an album (school year, title, description) and drops in photos.
2. A Web Worker in the browser decodes each file (`createImageBitmap`, EXIF orientation), produces two sizes, 400 and 1600 px on the long edge, and encodes them to WebP with jSquash. Re-encoding drops EXIF and GPS data.
3. Photos upload one at a time: `POST /api/panel/albums/:id/photos`, a multipart body with both files, each at most 1.5 MB, plus the mandatory "consent to publish images obtained" confirmation.
4. The server **does not trust the client**:
   - it parses RIFF/WebP and accepts only `VP8 `, `VP8L`, `VP8X` and `ALPH` chunks; `EXIF`, `XMP `, `ANIM`, `ICCP` and anything unknown are rejected;
   - it checks the dimensions in the header against the allowed sizes;
   - it computes SHA-256; the R2 keys are `g/<sha256>-s.webp` and `g/<sha256>-l.webp`, so no user input reaches a key;
   - a repeated upload of the same file is recognised by `sha256`.
5. An album is public only after "Opublikuj". Deletion is soft (`deleted_at`); a scheduled job removes the files from R2 after 30 days.

### 7.6 Public gallery and media

- `GET /api/gallery/years`, `/api/gallery/years/:year/albums`, `/api/gallery/albums/:id` return published albums only, cached at the edge (`s-maxage=60, stale-while-revalidate=600`).
- `GET /media/g/<sha256>-(s|l).webp` checks `photos` (album published, photo not deleted), then serves R2 through the Cache API with `Content-Type: image/webp`, `nosniff`, `Cache-Control: public, max-age=31536000, immutable` and `Cross-Origin-Resource-Policy: same-origin`.
- **Archive import** by `tools/import_gallery.py`: downloads from the current site (at most 4 parallel connections), Pillow (EXIF rotation, metadata removal, WebP 400/1600), upload to R2 over the S3 API, SQL for D1. The script is idempotent and resumes where it stopped.

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

### 8.3 Cryptography

- A request's personal data is one JSON document encrypted with AES-256-GCM (WebCrypto), a random 96-bit IV per record and `request.id` as AAD. The key `PII_KEY_<id>` is a Worker secret; `pii_key_id` in each row allows key rotation without downtime.
- `email_index` is HMAC-SHA256 with a separate `EMAIL_INDEX_KEY`.
- Status tokens come from `crypto.getRandomValues`; only their SHA-256 is stored.
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

A daily Cron job enforces retention and records every run in `audit_log`.

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
