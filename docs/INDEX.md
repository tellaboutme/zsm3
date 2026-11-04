# Documentation index

Routing table for this repository. Find the row that matches the work, open only that
document. English under `docs/en/` is the working documentation; Polish under `docs/pl/` is
written for the school and is a translation or a school-facing guide, not a second source of
truth.

## Authoritative

| Document                                           | Contains                                                                                                                                                   | Read it when                                                       | Area              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| [en/architecture.md](en/architecture.md)           | goals, legal requirements mapped to decisions, stack, repository layout, D1 data model, flows, security, privacy, accessibility, code quality, CI/CD, cost | changing the data model, an API boundary, security or the pipeline | whole system      |
| [en/development.md](en/development.md)             | requirements, command table, code rules, style rules, local data and media, worker tests, pull-request policy, ZAP exceptions, Windows limits              | setting the machine up, running gates, opening a pull request      | workflow          |
| [en/supply-chain.md](en/supply-chain.md)           | dependency policy and every granted exception with its review date                                                                                         | adding, updating or pinning a dependency, or triaging an advisory  | dependencies      |
| [en/design-system.md](en/design-system.md)         | visual character, rules against generic design, tokens, typography, components, responsive and quality checks                                              | touching CSS, tokens, typography or any component's look           | front end         |
| [en/panel.md](en/panel.md)                         | running the staff panel locally, roles, handling e-wniosek requests, enabling it in production, IndexNow on public edits                                   | working on `/panel`, roles, panel access or `/panel/wnioski`       | staff panel       |
| [en/blueprint.md](en/blueprint.md)                 | foundation, global chrome, sitemap and URLs, page templates, components, utilities, build order                                                            | adding or restructuring a page, a template or a global element     | front end         |
| [en/site-plan.md](en/site-plan.md)                 | principles, audiences and top tasks, information architecture, feature parity, content management, search engine optimisation, stages, open questions      | deciding scope, navigation, content ownership or stage order       | product           |
| [en/content-inventory.md](en/content-inventory.md) | the legacy-site link inventory tool: command, output statuses and review flags, safety bounds, limits of the result                                        | listing old WordPress pages and PDF links for the redirect review  | content migration |
| [en/gallery-archive.md](en/gallery-archive.md)     | the gallery archive dry run: stages, permission file, outcomes, manifest, resume, what is not included                                                     | preparing old school photos for the gallery without importing them | gallery migration |
| [en/adr/](en/adr/)                                 | numbered decisions: content managed in the panel (0001), visual direction (0002), no edge cache for pages (0003)                                           | a decision looks arbitrary, or you are about to reverse one        | decisions         |
| [RUNBOOK.md](RUNBOOK.md)                           | personal-data incident response: scope, detection, containment, secret rotation, D1 repair, notifications, recovery, postmortem                            | a suspected data incident, or rotating secrets and tokens          | operations        |
| [../SECURITY.md](../SECURITY.md)                   | how vulnerabilities are reported and handled                                                                                                               | answering or filing a vulnerability report                         | security          |

The repository rules file in the root carries the binding short form of everything above,
plus the command table and the change flow. It is the entry point for any change and is
always loaded, so treat it as the starting map rather than a reference to search.

## School-facing, Polish

| Document                                                 | Contains                                                                                                                                      | Read it when                                                              | Area         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| [pl/architektura.md](pl/architektura.md)                 | Polish rendering of the architecture document                                                                                                 | the school needs the system described, or Polish wording is in doubt      | whole system |
| [pl/podrecznik-redaktora.md](pl/podrecznik-redaktora.md) | editor handbook: logging in, roles, news, pages, timetable, documents, redirects, drafts, announcements, bells, page data, e-wniosek requests | changing panel behaviour or Polish panel copy that the handbook documents | staff panel  |
| [pl/runbook-notification.md](pl/runbook-notification.md) | notification templates for a personal-data breach (data protection officer, supervisory authority, data subjects)                             | an incident reaches the notification stage                                | operations   |

## Historical

Nothing is archived yet. A superseded decision stays in `en/adr/` with its status changed and
is amended by a later numbered decision rather than edited in place; `en/adr/0003` amending
`en/adr/0001` is the pattern to follow.

## Not documentation

`README.md` is the public introduction and the short path table. `.github/` holds workflows,
the composite setup action, Dependabot configuration and the pull-request template; the
pipeline is described in `en/architecture.md`, so read the workflow files only when changing
them.
