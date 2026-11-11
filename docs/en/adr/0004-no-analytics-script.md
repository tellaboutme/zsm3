# ADR 0004: No analytics script; traffic comes from server-side zone analytics

- Status: accepted
- Date: 2026-11-11

## Context

The site plan listed "cookieless analytics" (Cloudflare Web Analytics) for stage 6, while the architecture's legal table says the site runs no analytics or trackers, so it needs no consent banner. Cloudflare Web Analytics works through a JavaScript beacon loaded from `static.cloudflareinsights.com`. It would be the only third-party script on the site, it would need a CSP exception, and it would send visitor data to another endpoint. The site plan's own performance rule asks for "no third-party scripts".

The school's real questions are how many people visit and which pages they use. The old site's Google Analytics has collected nothing since 2023.

## Decision

1. The public site loads no analytics script, beacon or pixel.
2. Traffic numbers come from Cloudflare's server-side analytics for the zone and the Worker: requests, visits by path, status codes and countries. They need no code on the page and no cookie, and no data leaves Cloudflare.
3. The former live visitor counter is replaced by the same dashboard. Blocking abusive clients stays a Cloudflare WAF rule.

## Consequences

- The CSP stays without any analytics origin, and the legal table needs no change: there is no tracking and no consent banner.
- Per-page numbers are less detailed than a client-side beacon (no screen size, no referrer path inside the site). If the school ever needs more, that is a new decision with its own legal review.
- The school sees the numbers in the Cloudflare dashboard once its account exists (stage 7). Nothing is built in the repository.
