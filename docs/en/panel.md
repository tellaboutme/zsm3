# Staff panel

The panel at `/panel` is where school staff edit the site: news, content pages, the school-year calendar, documents, announcements, bell schedules, redirects and the structured datasets (staff, parent meetings, contacts, document forms, partners, job offers, programmes, navigation). Every save is audited, news, pages and datasets keep earlier versions that can be restored, and administrators manage who has access. The Polish editor's guide for staff is [docs/pl/podrecznik-redaktora.md](../pl/podrecznik-redaktora.md).

Access is enforced twice: Cloudflare Access in front of `/panel*` and `/api/panel/*`, and the Worker itself, which verifies the `Cf-Access-Jwt-Assertion` token against the team's keys on every API request and reads the role from the `staff` table. Without valid configuration the panel API answers 503 and lets nobody in.

## Running the panel locally

Local development has no Cloudflare Access, so `pnpm dev:auth` stands in for it: it serves a signing key on `127.0.0.1:8799` and prints a short-lived token for the seeded local administrator `dev@zsm3.local`. `pnpm start` already passes the matching local values (`ACCESS_TEAM_DOMAIN=http://127.0.0.1:8799`, `ACCESS_AUDIENCE=zsm3-dev`, `PANEL_ORIGIN=http://127.0.0.1:8787`) to the Worker; the deployed configuration in `apps/web/wrangler.jsonc` keeps them empty, and a plain-`http` issuer is accepted only on the loopback interface.

1. Build and start the site. This applies the migrations to the local D1 and loads the seed data, including the local administrator:

   ```bash
   pnpm dev
   ```

2. In a second terminal, start the key server and print a token, valid for 12 hours:

   ```bash
   pnpm dev:auth
   ```

3. Open `http://127.0.0.1:8787/panel`. Use `127.0.0.1`, not `localhost`: the panel only accepts changes from the configured origin, and a browser treats the two names as different sites.
4. Paste the printed `sessionStorage.setItem("panel-dev-token", …)` line into the browser console on that page and reload.

`pnpm dev:auth mint` prints a fresh token while the key server keeps running elsewhere, and `pnpm dev:auth reset` replaces the local signing key. The key is stored in `apps/web/.wrangler/dev-auth`, which git ignores. Deleting `apps/web/.wrangler/state` resets the local database to the migrations and seed.

## Roles

| Role             | Can do                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| `admin`          | everything, plus staff and roles, redirects and the audit log                      |
| `secretariat`    | all site content, plus handling e-wniosek requests                                 |
| `editor`         | all site content: news, pages, calendar, documents, announcements, bells, datasets |
| `gallery_editor` | the gallery once it ships; no content editing                                      |

The full route-by-role table is `PANEL_MATRIX` in `apps/worker/src/routes/panel/matrix.ts`, and a test calls every route with every role. Administrators cannot remove their own admin role or disable themselves, so the panel always keeps one administrator.

## Handling requests

`/panel/wnioski` is the staff side of e-wniosek, shown to `admin` and `secretariat` only; the tab is hidden from other roles, and the API answers them 403 regardless. It reads and writes nothing but the staff API from architecture.md §7.4.

- **List.** Summaries only — type, dates, id and status, never personal data — newest first, with a status filter. **Pokaż starsze** follows the composite cursor: it sends the previous page's `nextBefore` and `nextBeforeId` back as `before` and `beforeId`, so requests created in the same millisecond are neither skipped nor repeated.
- **Detail.** Personal data appears only here. An erased record (`piiErasedAt` set) says when it was erased; a record whose fields come back `null` without an erasure date could not be decrypted, and the panel says so instead of showing empty fields.
- **Transitions.** The buttons come from `staffNextStatuses` in `@zsm3/contracts/panel-requests`, the same table the Worker's lifecycle checks, minus `withdrawn`, which belongs to the applicant. Marking a request ready, confirming collection and rejecting all ask for confirmation first, because they mail the applicant or close the request.
- **Stale views.** Every transition sends the status the staff member was shown as `expectedStatus`. The Worker answers `409` when the stored status differs, and the D1 batch that writes the audit row, the notice and the update is conditioned on that same status, so a decision taken on an outdated view changes nothing and mails no one. The status alone is a sufficient token because the lifecycle never returns to a status it has left (a contract test checks that), so a request cannot go A → B → A behind a reader's back, and unlike `updatedAt` it cannot collide when two writes share a millisecond. `409` and `422` reload the detail instead of retrying.

The end-to-end specs for the page (`e2e/tests/panel.requests-*.spec.ts`) assert a clean console, with one recorded exception: WebKit reports a `style-src-attr` violation for the native `<select>` control's own rendering ("Refused to apply a stylesheet because its hash…"). The page sets no style attribute, and `/panel/pracownicy` on `main` shows the same report. `pageProblems` in `e2e/tests/panel-requests-fake.ts` drops exactly that message, in WebKit only (checked 2026-11-02, review 2027-02-02).

Nothing from a request reaches the URL, browser storage or the console. The list and detail schemas are parsed only in this page's scripts: importing them into the shared `lib/panel/models.ts` moves zod's schema construction ahead of the `jitless` switch in every panel bundle, and the Trusted Types policy then reports the blocked `Function` probe.

## Enabling the panel in production

These steps need the school's Cloudflare account and are done once.

1. Apply the D1 migrations before deploying, as for every release:

   ```bash
   pnpm --filter @zsm3/web exec wrangler d1 migrations apply DB --remote
   ```

2. In Cloudflare Zero Trust, create a self-hosted Access application for the site's domain covering the paths `/panel*` and `/api/panel/*`. Allow the school's identity provider (Microsoft 365 or Google Workspace with MFA) or one-time PINs for an allow-listed set of e-mail addresses, and set the session duration to 8 hours. Note the team domain (for example `zsm3.cloudflareaccess.com`) and the application audience (AUD) tag.
3. Store the three values as Worker secrets, so they never live in the repository:

   ```bash
   pnpm --filter @zsm3/web exec wrangler secret put ACCESS_TEAM_DOMAIN
   pnpm --filter @zsm3/web exec wrangler secret put ACCESS_AUDIENCE
   pnpm --filter @zsm3/web exec wrangler secret put PANEL_ORIGIN
   ```

   `ACCESS_TEAM_DOMAIN` is the team domain without a scheme, `ACCESS_AUDIENCE` is the AUD tag, and `PANEL_ORIGIN` is the site origin, for example `https://zsm3.pl`; requests that change data must come from exactly this origin.

4. Add the first administrator. Later staff are added in the panel under **Pracownicy i role**:

   ```bash
   pnpm --filter @zsm3/web exec wrangler d1 execute DB --remote --command "INSERT INTO staff (email, role, active, created_at, updated_at) VALUES ('name@school-domain.pl', 'admin', 1, datetime('now'), datetime('now'))"
   ```

5. Sign in at `https://<site>/panel` with that address. Requests from people who are not in `staff`, or whose account is disabled, are refused with 403.

Pages are rendered per request without an edge cache, so every save is visible on the next page view; see [ADR 0003](adr/0003-no-edge-cache-for-pages.md).

## Publishing and search engines

Every change to a public news item or content page is also the moment the site tells the search engines about it. The Worker submits the public address to IndexNow, which the participating engines (Bing and Yandex among them) use to recrawl a page without waiting for their next visit. IndexNow is meant for added, updated and deleted addresses, so the panel submits one address when:

- a news item or a content page becomes public (publishing a news item; saving a page as `published`);
- a public news item or page changes (an edit or a restored revision that differs in at least one field);
- a public news item or page stops being public (unpublishing a news item; saving a page as a draft). The previous address is submitted so that the engines recrawl it and find the 404 that the site now answers.

Nothing is sent for drafts, for a save or restore that changes nothing, for a refused request (validation error, unchanged publication status) or for a write that fails and rolls back. The rule is `announcesChange` in `apps/worker/src/domain/public-change.ts`. News addresses come from `newsPath` in `@zsm3/contracts/content`, the same function the site, the sitemap and the search index use, so every place names an article identically. A page's address is its stored path. Deleting an item is not part of the panel. Bells, events, announcements and datasets are not announced; the sitemap covers them.

The submission is **off until the host is configured**. It switches on with the `INDEXNOW_HOST` Worker variable, set next to the other variables in `apps/web/wrangler.jsonc` or in the Cloudflare dashboard:

```jsonc
"vars": { "INDEXNOW_HOST": "www.zespolszkolmechanicznych.edu.pl" }
```

The value is the host the engines fetch the key file from: a lower-case host name without a scheme, port or path (`indexNowHostSchema` in `@zsm3/contracts/indexnow`). While the variable is empty or missing the panel publishes silently, which is what the pre-launch site does until it opens `robots.txt` in stage 7. A value that is not a bare host name sends nothing and logs `indexnow_unavailable` with `errorName: "InvalidHost"` on every change that would be announced.

The key itself is part of the repository, not a secret: `packages/contracts/src/indexnow.ts` holds its value and `apps/web/public/<key>.txt` serves it, and `apps/web/test/indexnow-key.test.ts` fails if the two drift apart. The leak-scan exception for it is recorded in [supply-chain.md](supply-chain.md).

A notification never blocks or undoes a save. The request is answered once the D1 batch commits, and the submission runs afterwards through the request's `waitUntil`. An unreachable endpoint, a timeout or any other failure is logged as `indexnow_unavailable` with the error name only (no address and no content); a refusal is logged with `errorName: "HttpStatus"` and the status code. In every case the committed change stays. Each successful request sends at most one address, and the decision is taken from the status read before the write. Two editors who publish the same draft at the same moment can therefore both be announced; the engines treat the second submission as a repeat of the same address. The same pre-read status is what an edit writes back, so an edit that races with an unpublish can make the item public again; closing that needs status-guarded writes for news and pages, which is tracked separately.
