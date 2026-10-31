# Supply chain: policy and exceptions

## Policy

| Mechanism                        | Where                    | Effect                                                                                           |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `minimumReleaseAge: 10080`       | `pnpm-workspace.yaml`    | installs only versions older than 7 days; most package takeovers are caught within 1–3 days      |
| `exclude-newer = "7 days"`       | `tools/pyproject.toml`   | the same for Python                                                                              |
| `cooldown: 7`                    | `.github/dependabot.yml` | Dependabot proposes no version younger than 7 days                                               |
| `trustPolicy: no-downgrade`      | `pnpm-workspace.yaml`    | refuses a version published with weaker trust than earlier ones (no provenance after provenance) |
| `allowBuilds`                    | `pnpm-workspace.yaml`    | install scripts run only for explicitly allowed packages                                         |
| `blockExoticSubdeps`             | `pnpm-workspace.yaml`    | transitive dependencies come from the registry only, never from git or URLs                      |
| Actions by SHA, images by digest | `.github/`               | a tag cannot be silently re-pointed; zizmor enforces `hash-pin` for every action                 |
| `pnpm audit`, OSV-Scanner        | CI                       | any known vulnerability of any severity fails the build                                          |

An exception to the policy is allowed only with an entry below: what, why, when it was checked, and when to review it.

## Exceptions

### `minimumReleaseAgeExclude`

| Package                                 | Reason                                                                                                                                                                                                                                                     | Checked    | Review                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `vitest` and `@vitest/*` 4.1.12         | fixes advisories in `@vitest/mocker` (code injection through mocks, Windows path traversal); released 6 days before install; every package published through GitHub OIDC with provenance                                                                   | 2026-10-21 | remove after 2026-10-22, once the release is 7 days old |
| `fast-uri@3.1.9`                        | fixes four advisories (GHSA-w74x-v6f9-j3xg and GHSA-wjr9-j795-jxcr, moderate; GHSA-xhq7-xmqj-769h and GHSA-333x-w4r6-6crp, low); released 5 days before install; published through GitHub OIDC with provenance                                             | 2026-10-24 | remove after 2026-10-26, once the release is 7 days old |
| `happy-dom@21.0.4`                      | fixes GHSA-834v-8h66-3h79 (high severity host code execution through an unsanitized import alias after an incomplete first fix); released 4 days before install; published through GitHub OIDC with provenance                                             | 2026-10-24 | remove after 2026-10-27, once the release is 7 days old |
| `minimatch@11.0.1`                      | fixes GHSA-g3hv-75wg-m249 (denial of service through globparts amplification); the only release that carries the fix, published 3 days before install; `@eslint/config-array` (eslint) asks for `^10.2.4`, so the fix arrives through an `overrides` entry | 2026-10-31 | remove after 2026-11-03, once the release is 7 days old |
| `@isaacs/nonrecursive-glob-match@1.0.1` | new dependency of `minimatch` 11.0.1, the release that fixes GHSA-g3hv-75wg-m249; published 4 days before install                                                                                                                                          | 2026-10-31 | remove after 2026-11-03, once the release is 7 days old |

### `trustPolicyExclude`

| Package                      | Reason                                                                                                              | Checked    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| `semver@6.3.1`               | released by the npm team (lukekarrys) in 2023, before provenance existed; newer lines are published with provenance | 2026-10-21 |
| `chokidar@4.0.3`             | released by its author (paulmillr) in 2024, before the move to OIDC; 5.x has provenance                             | 2026-10-21 |
| `chromium-bidi@157.0.8090-0` | official Google account `chrome-devtools-npm`; required by puppeteer-core 25 for Lighthouse 13                      | 2026-10-21 |

The same policy picked older versions in two places:

- `lefthook` 2.2.1 instead of 2.2.2, which was published by hand without OIDC;
- `@cloudflare/vitest-pool-workers` 0.22.0 instead of 0.23.0, which has no provenance. The Worker's `compatibility_date` is therefore `2026-08-15`, the newest date its workerd supports.

### Vulnerabilities without a fix

None recorded. The previous entry, GHSA-vfj7-8cjw-p6xm (`braces` 3.0.3 through stylelint), was withdrawn by the advisory database on 2026-10-23 as not practically exploitable, so the ignore in `auditConfig.ignoreGhsas` and `osv-scanner.toml` was removed with it.

### `overrides`

`qs` 6.16.0, `sharp` 0.35.5, `undici` 7.30.1 (wrangler and miniflare) and 8.12.2 (astro, through unifont), `zod` 4.6.7, `happy-dom` 21.0.4, `fast-uri` 3.1.9 and `minimatch` 11.0.1 (eslint, through `@eslint/config-array`) are raised to fixed versions; Stryker, wrangler, Vitest, Astro and eslint pull these packages in as transitive dependencies. All pinned releases are older than 7 days except the ones excluded above.

### Dependabot

`@types/node` major updates are ignored: the types must match the Node.js 24 LTS runtime.

### Gitleaks historical test fixtures

Four `generic-api-key` findings from commit `74e0a35870dc52bfd56a00a5ee3a4ac88a0845c9` are ignored by exact commit, path, rule and line fingerprints in `.gitleaksignore`: `apps/worker/test/node/env.node.test.ts:7` and `apps/worker/vitest.config.ts:30,31,36`. These are synthetic test-only values, not issued credentials; rewriting published history would be disruptive. Checked: 2026-10-26. Review: 2027-01-26, or sooner if test fixtures or the Gitleaks rule change. CI explicitly loads the ignore file from the repository mount and continues to scan the full history for every other finding.

## Known scanner limitations

- **OSV-Scanner** reads only the first YAML document of a pnpm 12 `pnpm-lock.yaml` (15 internal packages). `.github/scripts/osv-scan.sh` extracts the last document (~1,000 packages) and fails if it has no `importers:` section.
- **actionlint** 1.7.12 does not know the `uses: $/...` self-repository syntax (GitHub, July 2026). One message is suppressed for `$/.github/actions/setup`; zizmor checks pinning of every other action.
- **Semgrep** rule `github-actions-mutable-action-tag` treats `$/...` as a mutable tag. The rule is disabled; zizmor's `hash-pin` policy covers the same risk more precisely.
