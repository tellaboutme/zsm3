# zsm3 project rules

These rules bind every change in this repository: `apps/`, `packages/`, `e2e/`, `tools/`,
`.github/` and `docs/`. They are the short form of the binding documents below; in a
conflict, the documents win.

## Read before working

- `docs/en/architecture.md` — system design, security model, data model, CI pipeline.
- `docs/en/development.md` — setup, commands, code rules, pull-request policy.
- `docs/en/supply-chain.md` — dependency policy and every exception to it.
- For UI work, follow `docs/en/design-system.md` and the design guidance in
  `docs/en/development.md`.

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
- Nothing from `.claude/` goes into the repository.
- No school personal data and no scraped photos in the public repository.

## Change flow

- Branch from an up-to-date `main`: `feat/…`, `fix/…`, `docs/…`, `ci/…`.
- Logic gets tests first.
- Local gates before a PR: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:mutation`, and the e2e suite after `pnpm build` (locally the Chromium headless
  shell, WebKit and mobile projects; Firefox runs in CI).
- Commit with Conventional Commits (lefthook pre-commit, commitlint on the message), push,
  and open the pull request with `gh pr create`.
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
