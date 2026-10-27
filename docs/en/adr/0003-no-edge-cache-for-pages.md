# ADR 0003: Pages are rendered per request without an edge cache

- Status: accepted
- Date: 2026-10-26
- Amends: [ADR 0001](0001-content-managed-in-panel.md), decision 2

## Context

ADR 0001 planned to cache rendered pages at the edge and purge the affected entries when staff publish. Since then every site page carries state that changes with the date rather than with publishing: the active announcement (including day-off notices from the calendar), today's bell schedule and the events of the current school year. A cached page would have to expire at midnight in `Europe/Warsaw` as well as on every publish, for every URL that shows the header or footer, which is all of them.

The load is small. A school website of this size serves a few thousand page views a day; the Workers free tier allows 100,000 requests a day and D1 five million reads a day. A page view costs one Worker request and four to six indexed D1 reads (announcement, bells, events, navigation, and the page's own content).

## Decision

1. Site pages are rendered on demand for every request and sent with `Cache-Control: public, max-age=0, must-revalidate`. There is no edge cache and therefore no purge on publish.
2. Static assets keep their long-lived immutable caching, and files under `/media/` stay content-addressed and immutable.
3. The decision is reviewed when daily Worker requests exceed 30,000 or D1 reads exceed 1 million a day in Cloudflare analytics. The first step then is the Workers Cache API with a short `s-maxage` (60 seconds) keyed by URL and day, which bounds staleness without a purge.

## Consequences

- Every change in the panel is visible on the next page view, which the editor's guide already promises.
- Running cost stays at 0 PLN with a margin of more than an order of magnitude.
- Page latency includes the D1 reads; they are indexed single-row or small-range queries run in parallel.
