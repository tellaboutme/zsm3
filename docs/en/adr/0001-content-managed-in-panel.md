# ADR 0001: Content is managed in the panel and rendered on demand

- Status: accepted
- Date: 2026-10-22

## Context

The first architecture kept news as content files in git and the public site fully static. An inventory of the current WordPress site shows that staff edit far more than news: pages, documents, the school-year calendar, job offers, pop-up announcements, the shortened-lessons schedule, day-off notices and partner banners. Teachers and secretaries cannot be expected to use git, and giving them GitHub accounts with write access to a public repository would be a security risk. Keeping content in git would therefore remove functionality the school has today.

## Decision

1. All school-maintained content lives in D1 (text, structure) and R2 (files) and is edited in the panel behind Cloudflare Access.
2. The public site uses hybrid rendering with the Astro Cloudflare adapter on the same Worker: the design shell and assets are built ahead of time; pages that show editable content are rendered on demand from D1 and cached at the edge. Publishing in the panel purges the affected cache entries, so changes appear within seconds.
3. Rich text is stored as a structured document and rendered on the server through an allow-list of nodes and attributes. Raw HTML is never stored or rendered.
4. The current site is imported once into D1 by a script in `tools/`, and every old URL gets a 301 redirect.

## Consequences

- No functionality is lost, and no developer is needed for routine edits.
- The Worker now renders HTML, so page rendering joins the API under the same tests, security headers and performance budgets. CSP stays strict because no inline scripts or styles are emitted.
- Edge caching keeps page responses fast and within the Workers free tier; a cache miss costs one D1 read per content block.
- The panel becomes a larger part of the project (site plan, stage 3), and an editor's guide in Polish is required.
- Search moves from a static index to D1 full-text search (FTS5).
