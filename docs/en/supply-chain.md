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

| Package                         | Reason                                                                                                                                                                                   | Checked    | Review                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `vitest` and `@vitest/*` 4.1.12 | fixes advisories in `@vitest/mocker` (code injection through mocks, Windows path traversal); released 6 days before install; every package published through GitHub OIDC with provenance | 2026-10-21 | remove after 2026-10-22, once the release is 7 days old |

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

| Advisory            | Package                                     | Why it is not exploitable                                                                                         | Recorded in                                   | Review                               |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| GHSA-vfj7-8cjw-p6xm | `braces` 3.0.3 (via stylelint → micromatch) | stack exhaustion needs attacker-supplied nested patterns; stylelint only receives fixed globs from `package.json` | `auditConfig.ignoreGhsas`, `osv-scanner.toml` | 2027-01-21 or when a fix is released |

### `overrides`

`qs`, `sharp` and `undici` are raised to fixed versions (all older than 7 days); Stryker and wrangler/miniflare pull them in.

### Dependabot

`@types/node` major updates are ignored: the types must match the Node.js 24 LTS runtime.

## Known scanner limitations

- **OSV-Scanner** reads only the first YAML document of a pnpm 12 `pnpm-lock.yaml` (15 internal packages). `.github/scripts/osv-scan.sh` extracts the last document (~1,000 packages) and fails if it has no `importers:` section.
- **actionlint** 1.7.12 does not know the `uses: $/...` self-repository syntax (GitHub, July 2026). One message is suppressed for `$/.github/actions/setup`; zizmor checks pinning of every other action.
- **Semgrep** rule `github-actions-mutable-action-tag` treats `$/...` as a mutable tag. The rule is disabled; zizmor's `hash-pin` policy covers the same risk more precisely.
