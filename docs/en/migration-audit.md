# Legacy migration audit

`zsm3-migration-audit` compares the old WordPress site's addresses with the new site and the
reviewed redirect map. It is a dry run: it reads files and, optionally, a local preview, and
writes three reports. It never writes to D1, never imports or publishes content and never
contacts the old site. It supports the stage-2 redirect review in
[development.md](development.md) together with the
[content inventory](content-inventory.md).

```powershell
uv run --directory tools --locked zsm3-migration-audit --inventory "$env:LOCALAPPDATA\Temp\zsm3-inventory.json" --out-dir "$env:LOCALAPPDATA\Temp\zsm3-audit"
uv run --directory tools --locked zsm3-migration-audit --urls old-urls.txt --probe http://127.0.0.1:8787 --sitemap sitemap.xml --cms-paths cms-paths.txt --out-dir "$env:LOCALAPPDATA\Temp\zsm3-audit" --overwrite
```

## Inputs

| Option         | Default                                | Content                                                        |
| -------------- | -------------------------------------- | -------------------------------------------------------------- |
| `--inventory`  | none (repeatable)                      | JSON written by `zsm3-content-inventory`; its status is kept   |
| `--urls`       | none (repeatable)                      | one address or path per line; `#` starts a comment             |
| `--map`        | `tools/data/legacy-url-map.csv`        | reviewed `from_path,to_path` rows, validated like the importer |
| `--unresolved` | `tools/data/legacy-url-unresolved.csv` | `from_path,previous_to_path,reason` rows                       |
| `--pages`      | `apps/web/src/pages`                   | the Astro pages directory used as the route table              |
| `--cms-paths`  | none                                   | paths of D1 pages, one per line, to check for shadowing        |
| `--sitemap`    | none                                   | the new site's `sitemap.xml`, saved to a file                  |
| `--probe`      | none                                   | a local preview origin; only `http` on loopback is accepted    |
| `--delay`      | 0.05                                   | seconds between probe requests                                 |

At least one `--inventory` or `--urls` source is required. Addresses on any host other than the old site (with or without `www.`) are rejected, so a list that mixes in links to other sites cannot be mistaken for old paths. Unresolved rows are keyed like requests, so a row written with Polish letters still matches; a map row written that way is reported as `mapped_unencoded`, because the Worker would never match it. Every address is reduced the way
the Worker sees it: the path is encoded as a browser sends it, so Polish letters become `%C4%99`,
characters such as `"`, `<` and `{` are escaped, and existing escapes are kept exactly as
written. In particular `%2F` stays an encoded slash and is a different path from `/`, as it
is in `URL.pathname`. A `%` that starts no valid escape is kept literally, and Unicode is not
normalised, because the Worker does neither. The query and fragment are dropped, and the lookup key is lower-cased with one trailing
slash removed, as in `normalisePath`. Addresses that differ only in case, a trailing slash or
a query are reported once, with every original listed and a `variants_collapsed` or
`query_ignored` note; because Astro answers each spelling separately, such a finding takes the most severe category of any of its variants, whatever the input order. Input that is empty, holds whitespace, is not a site path or web
address, has dot segments (also `%2e%2e`), has a backslash (browsers read it as `/`) or is longer than 500 characters once encoded is listed under
_Rejected input_.

## How the new site answers

The Worker looks up a redirect only after Astro has answered 404 to a `GET` or `HEAD`. Paths
ending in a file suffix (`pdf`, images, fonts, scripts and the like) and paths under `/api`,
`/media`, `/panel`, `/_astro` and `/.well-known` are never looked up. A redirect is followed
through at most 8 rows and stops at the first destination that is served; a loop serves 404,
and so does any hop whose destination is itself under a reserved prefix or has a file suffix,
because the Worker refuses such a destination (`mapped_reserved`).
`tools/tests/test_migration_paths.py` reads `apps/web/worker/legacy-redirect.ts` and fails
when its suffix list or prefixes drift from the Python copy.

Without `--probe`, existence comes from the pages directory: a fully static file route is
certain; a dynamic route (`[section]/index.astro`, `[section]/[page].astro`, news and
programme slugs) means the path may exist depending on D1 and is reported as unverified.
With `--probe`, the tool requests each legacy path and each mapped destination from the local
preview once, in sorted order, and a 200 is taken as served. Any other definite answer
(3xx, 4xx) means not served, but a 5xx or 429 says nothing about the page: such a path, or a
redirect whose hop lands on one, is reported as `probe_error` instead of `missing`, the
reports are still written in full, and the command exits with 3 so the run is not mistaken
for a complete one. The site answers a path with a
trailing slash by a 301 to the same path without it and only then serves it or looks up a
redirect, so that one redirect is followed; no other redirect is. At most 5000 paths are
probed. Astro routes are case-sensitive: `/Kontakt` is not `/kontakt`, and a mixed-case old
address is redirected only if the map holds its lower-cased path.

## Output

`--out-dir` must lie outside the repository, because old paths can contain names. The tool
writes `manifest.json`, `report.md` and `candidates.csv` there, each first to a temporary
file that is then renamed. Existing reports are replaced only with `--overwrite`. The same
inputs give byte-identical files: no timestamps, sorted findings, LF line endings.

| Category                | Meaning                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `probe_error`           | the preview answered 5xx or 429; rerun the probe before drawing conclusions  |
| `mapped_loop`           | the chain loops or needs more than 8 hops; the Worker serves 404             |
| `mapped_reserved`       | a destination is a reserved or file path; the Worker refuses it, serves 404  |
| `mapped_target_missing` | mapped, but the destination is not served                                    |
| `mapped_unencoded`      | the map row holds raw letters, so it never matches a percent-encoded request |
| `mapped_shadowed`       | mapped, but the old path is itself served, so it never redirects             |
| `mapped_chain`          | reaches its destination through another redirect                             |
| `missing`               | no mapping and not served                                                    |
| `document_review`       | a document link (PDF, Office, OpenDocument); never redirected                |
| `not_redirectable`      | an asset or reserved path the legacy lookup never handles                    |
| `unresolved`            | listed in the unresolved file; needs content or a school decision            |
| `unverified`            | matches only a dynamic route; probe a preview to decide                      |
| `mapped_unverified`     | mapped to a dynamic route; probe a preview to decide                         |
| `mapped`                | redirects to a served destination                                            |
| `live_same_path`        | served at the same path                                                      |

Findings also carry `old_site:<status>` from the inventory and `target_not_in_sitemap` when a
sitemap was given and the destination is missing from it. `candidates.csv` proposes
`collapse_chain`, `remove_shadowed`, `break_loop`, `choose_target` (also for `mapped_reserved`) and `encode_source` changes; it is a
worklist, not an import file, and nothing applies it.

With `--cms-paths`, D1 pages are checked against the route table: `cms_shadowed` names the
static file that serves the path instead of the page, `cms_unroutable` means no route can
serve it, and `cms_section_level` marks one-segment pages served by `[section]/index.astro`,
where a section hub wins when the stored navigation shows that section. The hub case depends
on D1 navigation and is reported for review rather than decided.

## Limits

The audit is only as complete as its sources: the content inventory lists links, not every
page that ever existed. A probe answers for the local seed data, not production content.
Documents are listed for review only; this tool never downloads them. Do not commit the
reports.
