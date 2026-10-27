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
| `secretariat`    | all site content; request handling once e-wniosek ships                            |
| `editor`         | all site content: news, pages, calendar, documents, announcements, bells, datasets |
| `gallery_editor` | the gallery once it ships; no content editing                                      |

The full route-by-role table is `PANEL_MATRIX` in `apps/worker/src/routes/panel/matrix.ts`, and a test calls every route with every role. Administrators cannot remove their own admin role or disable themselves, so the panel always keeps one administrator.

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
