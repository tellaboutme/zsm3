# ADR 0005: Announcements are banners only; urgent ones cannot be hidden

- Status: accepted
- Date: 2026-11-11

## Context

The old site showed pop-ups (zsm3-popup-manager). The site plan's parity table promised "a dialog only for critical notices". The blueprint (§2.6) and the code have only one form: one active banner at the top of every page, with severity information, important or urgent.

## Decision

1. An announcement is always the banner from the blueprint §2.6. There is no modal dialog for any severity.
2. `info` and `important` banners can be hidden for the browser session. `urgent` banners cannot be hidden and stay on every page until their end date.
3. Day-off notices from the calendar use the same banner.

## Consequences

- No modal ever interrupts a visitor or traps focus without being asked for.
- An urgent message is still impossible to miss, because it stays above the header on every page.
- Editors choose only text, severity, an optional link and the dates; the editor's guide describes exactly that.
