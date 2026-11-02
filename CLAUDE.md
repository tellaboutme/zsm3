# zsm3 project rules

These rules bind every change in this repository: `apps/`, `packages/`, `e2e/`, `tools/`,
`.github/` and `docs/`. They are the short form of the binding documents below; in a
conflict, the documents win.

## What this is

Public website and staff panel for a Polish technical school. Astro (static plus on-demand
pages) and a Hono API, both deployed as Cloudflare Workers, with D1, R2 and Queues behind
them. pnpm 12 workspace on Node 24, TypeScript in strict mode, Zod contracts shared between
site and API, Python 3.13 repository tooling run through uv.

## Read before working

- `docs/INDEX.md` — routing table for every document: read it instead of opening docs blindly.
- `docs/en/architecture.md` — system design, security model, data model, CI pipeline.
- `docs/en/development.md` — setup, commands, code rules, pull-request policy.
- `docs/en/supply-chain.md` — dependency policy and every exception to it.
- For UI work, follow `docs/en/design-system.md` and the design guidance in
  `docs/en/development.md`.

## Where things live

- `apps/worker/src` — API: `app.ts` middleware order, `http/` problem+json and headers,
  `security/`, `domain/` (pure), `storage/` repositories, `routes/`, `mail/`, `jobs/`,
  `logging/` typed events, feature modules `requests/` and `short-links/`.
- `apps/worker/migrations`, `apps/worker/seed` — D1 schema and local sample content.
- `apps/web/src` — `pages/` (including `/panel`), `layouts/`, `components/`, `scripts/`
  (site modules at the top level, `panel/`), `styles/tokens.css` and `styles/global.css`,
  `server/` for on-demand D1 access, `middleware.ts` for page security headers.
- `packages/contracts` — Zod schemas, DTOs, statuses. `packages/lint-rules` — this
  repository's own ESLint and Stylelint rules.
- `e2e` — Playwright, axe, Lighthouse budgets. `tools` — Python package `zsm3_tools`.

## Commands

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `pnpm start`         | migrations, seed, then serves http://127.0.0.1:8787         |
| `pnpm dev`           | preview build, then `pnpm start`                            |
| `pnpm dev:auth`      | prints a panel token in place of Cloudflare Access          |
| `pnpm format:check`  | Prettier                                                    |
| `pnpm lint`          | ESLint, Stylelint, ruff, no-comments, repository rules      |
| `pnpm typecheck`     | `tsc`, `astro check`, `wrangler types --check`, mypy strict |
| `pnpm test`          | Vitest (Node and workerd) and pytest                        |
| `pnpm test:mutation` | Stryker                                                     |
| `pnpm test:e2e`      | preview build; Playwright: pages, headers, axe, Lighthouse  |
| `pnpm check`         | format, lint, typecheck, test, e2e in order; not mutation   |

Run the narrowest gate that covers the change; run `pnpm check` only before a pull request.

## Non-negotiable code rules

- No comments in TypeScript, Astro, CSS or Python; intent lives in names and structure.
- No `any`, no unchecked `as`, no `!`; no `@ts-ignore`, `# type: ignore` or `noqa`.
  Lint rules cannot be disabled inline.
- External data is parsed with a Zod schema at the boundary; inside, plain types only.
- `Clock` and `Random` are injected; the domain layer is pure — no Hono, D1 or R2 there; no
  global mutable state.
- `switch` over a union is exhaustive (`never`); no floating promises.
- Files stay under ~200 lines, functions under ~40; cyclomatic complexity is capped by lint.

## Security first

- SQL goes through `.prepare().bind()` only; template strings inside `prepare` fail lint.
- No `innerHTML`; DOM APIs only.
- Strict CSP: no inline scripts or styles, no `unsafe-inline`.
- Every API response goes through the security-header middleware and `problemResponse`, with
  a header test.
- Personal data never reaches logs — the structured logger accepts only typed events without
  it.
- State-changing API requests require an `Origin` equal to the site and a JSON body (CSRF).

## Quality gates

- 100% line and branch coverage; mutation score ≥ 90% (Stryker).
- axe: zero violations on every page and form state; the Lighthouse budgets hold.
- A failing or skipped gate is never "fine for now".

## Supply chain

- Dependencies are added and updated only through pnpm, under the workspace policy:
  `minimumReleaseAge` of 7 days, `trustPolicy: no-downgrade`, `allowBuilds` and
  `blockExoticSubdeps`.
- Never weaken a policy silently: every exception goes into `docs/en/supply-chain.md` with a
  reason, the date it was checked and a review date.

## Languages

- Code, identifiers, commit messages and technical docs: English.
- UI copy: Polish.
- School-facing documentation: Polish, under `docs/pl/`.
- No Russian anywhere in the repository.

## Attribution and privacy

- Commits, pull requests, docs and code must not mention Claude, Anthropic or AI assistance,
  and must not carry `Co-Authored-By` or "Generated with" lines.
- Commits are authored by `tellaboutme <273436872+tellaboutme@users.noreply.github.com>`.
- Nothing from `.claude/` goes into the repository, and no `.claude/` entry belongs in
  `.gitignore` either — `lint:repo` rejects the marker in tracked files. Agent configuration
  stays outside the repository, or is excluded through the shared `.git/info/exclude`.
- No school personal data and no scraped photos in the public repository.

## Change flow

- Branch from an up-to-date `main`: `feat/…`, `fix/…`, `docs/…`, `ci/…`.
- Logic gets tests first.
- Local gates before a PR: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:mutation`, and the e2e suite after `pnpm build` (locally the Chromium headless
  shell, WebKit and mobile projects; Firefox runs in CI).
- Commit with Conventional Commits (lefthook pre-commit, commitlint on the message), push,
  and open the pull request with `gh pr create`.
- Run a code review over the diff before asking for the merge (`/code-review`, or
  `/code-review ultra` for security-, data- or panel-touching changes); green CI is not a
  review.
- Merge (squash) only when every CI check is green; after merge, sync `main` and delete the
  branch.
- Dependabot pull requests: merge when green and consistent with the policy, otherwise close
  with a reason.

## Windows workstation

- Node and pnpm live at `C:\Program Files\nodejs` and `%APPDATA%\npm`; add both to `PATH` in
  Git Bash.
- Python runs with `python -I`; files written by Python on Windows get CRLF unless written in
  binary mode — the repository is LF only.
- Playwright's Firefox and full Chromium builds do not start locally on this machine; run the
  Chromium headless shell, WebKit and mobile projects.
- Docker-based scanners need Windows paths (`pwd -W`) and `MSYS_NO_PATHCONV=1`.
- Work usually happens in a git worktree of this repository, so branch, local D1 state and
  `node_modules` differ per directory; never reach into another worktree.

## Finding code without reading the repository

- Search before reading: `export (async function|function|const|class) <name>` finds a
  definition; `<name>(` or `from "…/<module>"` finds the callers.
- Read line ranges, not whole files, once a search has located the symbol.
- The layout above is the map; do not list directories recursively, and never descend into
  `node_modules`, `dist`, `coverage`, `reports`, `.astro`, `.wrangler` or `.venv`.
- A file already quoted in the conversation is already context; do not read it again.
- Keep large command output out of the conversation: send a long run to a file and grep it
  for failures — but never hide an error to make a gate look green.
- Delegate only genuinely broad searches or verbose investigations to a subagent; a trivial
  edit does not need one.

## Keeping context

When compacting, keep: the current task and its acceptance criteria; decisions taken and
their reasons; the paths and symbols in play; files already changed; gate results together
with the command that produced them; open bugs; the next concrete step. Drop: terminal logs,
superseded attempts, repeated file contents, and anything already written down in the
repository or in git history.

Record a durable finding — a non-obvious constraint, a lint or gate trap, a correction from
the user — once, in memory, and keep it short. Anything derivable from the code, the docs or
`git log` stays out: do not restate the architecture, and do not keep a session changelog in
the repository.
