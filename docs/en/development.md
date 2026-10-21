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
| `pnpm dev`                          | builds the site and serves it with the Worker on http://127.0.0.1:8787                     |
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

## Worker tests

Every test in `apps/worker/test` runs twice: in Node, where mutation testing runs, and in the real workerd runtime, for compatibility. Tests that need workerd itself are named `*.workers.test.ts`.

## Pull requests

`main` changes only through pull requests. A pull request is merged when every CI job is green: format, lint, types, unit and integration tests, mutation tests, end-to-end tests, ZAP, static security analysis, dependency review and CodeQL.

## Known local limitation (Windows 11 build 26200)

Playwright's Firefox and full Chromium builds fail to start on this Windows build (side-by-side configuration error). Chromium headless shell and WebKit work, so locally run:

```bash
pnpm build
```

```bash
pnpm --filter @zsm3/e2e exec playwright test --project chromium --project webkit --project mobile
```

CI on Linux runs all four projects.
