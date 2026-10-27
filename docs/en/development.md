# Development

## Requirements

- Node.js 24 (≥ 24.20) and pnpm 12.13 (`npm i -g pnpm@12.13.0`)
- Python 3.13 and uv ≥ 0.12
- Docker, for the security scanners (optional locally, always run in CI)

```bash
pnpm install
```

```bash
uv sync --directory tools --locked
```

```bash
pnpm exec playwright install chromium firefox webkit
```

## Commands

| Command                             | What it does                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev`                          | builds the preview site and runs `pnpm start`                                              |
| `pnpm start`                        | applies migrations to the local D1, loads the seed data and serves http://127.0.0.1:8787   |
| `pnpm build` / `pnpm build:preview` | production build / preview build (adds the pattern library at `/wzornik`)                  |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                   |
| `pnpm lint`                         | ESLint (TypeScript and Astro), Stylelint, ruff, no-comments check for Python               |
| `pnpm typecheck`                    | `tsc`, `astro check`, `wrangler types --check`, mypy `--strict`                            |
| `pnpm test`                         | Vitest (Node and workerd) and pytest; 100% coverage is required                            |
| `pnpm test:mutation`                | Stryker; a score below 90% fails                                                           |
| `pnpm test:e2e`                     | Playwright in Chromium, Firefox, WebKit and mobile Chrome: pages, headers, axe, Lighthouse |
| `pnpm check`                        | all of the above in order                                                                  |

lefthook runs Prettier, ESLint, Stylelint and ruff on staged files before each commit, and commitlint checks the message (Conventional Commits).

## Code rules

- No comments in TypeScript, Astro, CSS or Python; `local/no-comments` (ESLint and Stylelint) and `zsm3-no-comments` enforce it.
- Lint rules cannot be disabled inline (`noInlineConfig`).
- External data is parsed with a Zod schema at the boundary; `as`, `!` and `any` are banned.
- SQL only through `.prepare(...).bind(...)`; template strings inside `prepare` fail lint.
- Every new API response goes through the security-header middleware and `problemResponse`, with a header test.

## Styles

- Tokens live only in `apps/web/src/styles/tokens.css`; colours use `light-dark()` so each token is defined once for both themes.
- Stylelint rejects literal colours, font families, font sizes, spacing, radii, z-indices and durations outside the tokens file.
- Global CSS uses cascade layers: `reset, base, layout, motion, utilities, overrides`. Component styles are scoped in their `.astro` files.
- Accessibility settings are attributes on `<html>` (`data-text`, `data-contrast`, `data-font`, `data-underline`, `data-grayscale`, `data-motion`, `data-theme`) that override tokens.

## Local data

`pnpm start` keeps the local D1 database in `apps/web/.wrangler/state`. The seed in `apps/worker/seed` writes sample news through the same repositories the site reads with; running it again updates the rows instead of duplicating them. Delete the directory to start from an empty database.

`apps/worker/seed/files.json` lists the school's public files by SHA-256 and size. The files themselves are not in the repository: put them as `<sha256>.<format>` in a `zsm3_media` directory next to the repository, and `pnpm start` loads them into the local R2 after checking each hash. `ZSM3_MEDIA` points somewhere else. Without the files the pages still render and file links answer 404.

## Legacy URL import

`zsm3-import-legacy-urls` loads a batch of legacy addresses into the `redirects` table. It ships no data of its own; the corpus is supplied at run time. Every row is validated against the same rules as `redirectSchema` and `normalisePath` (`packages/contracts/src/content.ts`, `apps/worker/src/storage/redirects-repo.ts`): the source path must start with `/`, hold no whitespace and at most 500 characters, and is stored lower-cased with one trailing slash removed; the target must be an internal site path (lower-case segments, no trailing slash, at most 300 characters) different from the source. The self-redirect comparison uses the normalised source, i.e. it is stricter than the contract, which compares the raw values.

Sources are passed with `--source` (repeatable): a CSV file whose first row is the header `from_path,to_path`, or an old-site `sitemap.xml` (`<urlset>` with `<loc>` entries — the path of each URL is used). Sitemap imports require an explicit `--to` pointing to a verified destination shared by every URL in that sitemap; use CSV for per-URL destinations. Rows not yet in the database are imported, and rows already stored with the same target are skipped. A row that already exists with a different target is reported as a conflict (`conflict: db … != corpus …`) and left untouched unless `--update` is passed, which rewrites those rows with the repository's own UPSERT (`INSERT … ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path`). Duplicates inside the batch and invalid rows are rejected with reasons. Imported rows whose source path holds raw non-ASCII or percent characters are counted as warnings, because browsers request percent-encoded pathnames and such a row can never match. A summary counts imported, updated, skipped, conflicts, rejected and warnings.

```bash
uv run --directory tools --locked zsm3-import-legacy-urls --source legacy.csv --dry-run --sql-out redirects.sql
uv run --directory tools --locked zsm3-import-legacy-urls --source data/legacy-url-map.csv
uv run --directory tools --locked zsm3-import-legacy-urls --source legacy.csv --update
uv run --directory tools --locked zsm3-import-legacy-urls --source legacy.csv --remote --yes
```

By default the batch goes to the local D1 through `pnpm --filter @zsm3/web exec wrangler d1 execute DB --local`, with the state in `apps/web/.wrangler/state`; run the command from inside the repository. `--dry-run` writes the validated statements to `--sql-out` instead of writing to the database; it still reads the local D1 through wrangler to resolve the rows that are already present. `--remote` writes to production and additionally requires `--yes`. Valid rows are committed even when others are rejected, so a partially successful import exits 1; the exit code is also 1 for unresolved conflicts, rejections and wrangler failures, and 2 for usage errors.

The reviewed corpus lives in [data/legacy-url-map.csv](../../tools/data/legacy-url-map.csv): page paths harvested from the live WordPress navigation of `zespolszkolmechanicznych.edu.pl`, mapped onto the routes that exist on the new site (static pages, the sixteen seeded D1 pages, programme slugs and matching seeded news articles). [Unresolved paths](../../tools/data/legacy-url-unresolved.csv) retain their previous proposed targets and the reason they are not imported. Missing articles, club and competition archives, video presentations, student materials, class teachers and the school's previous RODO information need their actual content and a verified destination before import. Uploads, the gallery archive (stage 5), project pages and other sections without a live target are intentionally absent until their destinations exist.

Of the 106 inventoried source paths, 56 have reviewed destinations and 50 remain unresolved; this is not a complete crawl. The old site's `/sitemap.xml`, `/sitemap_index.xml` and `/wp-sitemap.xml` currently return the home page as HTML, not URL lists. Consequently the number and identity of additional crawled URLs cannot be measured from this repository. Before claiming the stage-2 redirect requirement is complete, obtain a historical crawl or sitemap export (including document URLs), compare its normalised source paths against both CSV files, choose verified live destinations for missing paths, and import the reviewed map. The import is an explicit operational step; the CSV alone does not populate D1.

## Worker tests

Every test in `apps/worker/test` runs twice: in Node, where mutation testing runs, and in the real workerd runtime, for compatibility. Tests that need workerd itself are named `*.workers.test.ts`.

## Pull requests

`main` changes only through pull requests. A pull request is merged when every CI job is green: format, lint, types, unit and integration tests, mutation tests, end-to-end tests, ZAP, static security analysis, dependency review and CodeQL.

## ZAP rules that do not fail the build

`.zap/rules.tsv` fails the baseline scan on every alert except these, which do not apply to a static site with no sessions or secrets in pages:

| Rule  | Name                           | Why it is ignored                                                                                                                                                                                  |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10049 | Content Cacheability           | Informational report of cache headers; caching is set deliberately in `_headers` and tested end to end.                                                                                            |
| 90005 | Fetch Metadata Request Headers | Asks the server to validate `Sec-Fetch-*` on requests; the pages are static and carry no state that a cross-site request could change.                                                             |
| 10094 | Base64 Disclosure              | Matches any 30-character run of letters, digits and slashes, so it fires on ordinary URL paths and content-addressed file keys. Secrets in the repository and build output are caught by gitleaks. |
| 10109 | Modern Web Application         | Informational: it notes that a page renders content with JavaScript and suggests the AJAX spider. The search page renders results in the browser by design; the other pages are static.            |

## Known local limitation (Windows 11 build 26200)

Playwright's Firefox and full Chromium builds fail to start on this Windows build (side-by-side configuration error). Chromium headless shell and WebKit work, so locally run:

```bash
pnpm build
```

```bash
pnpm --filter @zsm3/e2e exec playwright test --project chromium --project webkit --project mobile
```

CI on Linux runs all four projects.
