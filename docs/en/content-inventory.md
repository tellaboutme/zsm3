# Legacy content inventory

`zsm3-content-inventory` lists the public pages and document links of the old WordPress site at
`https://www.zespolszkolmechanicznych.edu.pl`. It supports the stage-2 redirect review in
[development.md](development.md); it does not import anything.

```powershell
uv run --directory tools --locked zsm3-content-inventory "$env:LOCALAPPDATA\Temp\zsm3-inventory.json" --max-pages 100 --max-depth 2 --delay 1
uv run --directory tools --locked zsm3-content-inventory out.json --seed https://www.zespolszkolmechanicznych.edu.pl/kontakt
```

The crawl always starts from the home page; each `--seed` adds another page on the same HTTPS
origin. The command exits with 0 when the file is written, 2 for malformed arguments, and 1
with a message on standard error when a seed or a limit is invalid, robots.txt cannot be used, or the file cannot be written.

## Output

A JSON array, UTF-8 with LF line endings, in crawl order; the same site state gives the same
file. Each entry has `url`, `kind` (`html` or `pdf`), `status`, `discovered_from`, `depth` and
`review_flags`.

| Status                  | Meaning                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `discovered`            | fetched as HTML; its links were queued                        |
| `linked_not_downloaded` | a PDF link; never fetched, so it may not exist                |
| `robots_denied`         | robots.txt forbids it; never requested                        |
| `limit_not_fetched`     | beyond `--max-pages` or `--max-depth`                         |
| `discovery_limit`       | fetched, but the 10,000-URL queue cap dropped further links   |
| `http_<code>`           | any status other than 200, including redirects (not followed) |
| `not_html_or_too_large` | not `text/html`, or compressed; the body is not read          |
| `fetch_error:<type>`    | network, protocol or size-limit failure                       |

Every entry carries `editorial` and `privacy`; PDFs add `copyright`, `document_accessibility`
and `verify_document`; any status other than `discovered` adds `unresolved`. Flags are
follow-up checks, not approval.

## Safety bounds

- robots.txt is read first; the crawl stops if it is missing, not `text/plain` or invalid.
  Groups match the `ZSM3ContentInventory` product token or `*`; wildcards, `$` anchors and the
  longer of `Crawl-delay` and `Request-rate` apply; blank lines do not end a group.
- Only the exact origin is requested. Queries and fragments are dropped, paths are
  percent-encoded once, and `/wp-admin`, `/wp-json` and `/wp-login.php` are excluded.
- Only extensionless, `.html`, `.htm` and `.php` paths are fetched, and only `text/html`
  bodies without content encoding are read: at most 1 MB per page and 100 KB for robots.txt,
  15 seconds per request, at least one second between pages, 1–1000 pages, depth 0–5.
- Page bodies are parsed in memory for `<a href>` links and discarded; no text, attachment or
  photo is stored. A server that labels a binary file as HTML cannot be detected from headers.

## Limits of the result

It is a link inventory, not an archive: JavaScript-only, orphaned, paginated and unlinked pages
can be missed. No URL is mapped to a new route automatically. Keep the output outside the
repository until it is reviewed, because public paths can contain names. Do not run the tool
against authenticated pages or use it to collect staff or student data.
