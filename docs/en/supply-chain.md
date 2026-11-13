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

None. The earlier exclusions (vitest 4.1.12, `fast-uri` 3.1.9, `happy-dom` 21.0.4, `minimatch` 11.0.1, `@isaacs/nonrecursive-glob-match` 1.0.1) were removed on 2026-11-13, once each release was older than 7 days.

### `trustPolicyExclude`

| Package                      | Reason                                                                                                              | Checked    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| `semver@6.3.1`               | released by the npm team (lukekarrys) in 2023, before provenance existed; newer lines are published with provenance | 2026-10-21 |
| `chokidar@4.0.3`             | released by its author (paulmillr) in 2024, before the move to OIDC; 5.x has provenance                             | 2026-10-21 |
| `chromium-bidi@157.0.8090-0` | official Google account `chrome-devtools-npm`; required by puppeteer-core 25 for Lighthouse 13                      | 2026-10-21 |

The same policy picked older versions in two places:

- `lefthook` 2.2.1 instead of 2.2.2, which was published by hand without OIDC;
- `@cloudflare/vitest-pool-workers` 0.22.0 instead of 0.23.0, which has no provenance. The Worker's `compatibility_date` is therefore `2026-08-15`, the newest date its workerd supports.

### Deprecated releases waiting for the release age

`tldts-core` 7.4.20 (lighthouse, through `tldts-icann`, end-to-end tests only) was marked deprecated by its author as a partial release; the replacement 7.4.22 and later were all published on or after 2026-11-11. It carries no advisory. Checked: 2026-11-13. Review: 2026-11-18, when 7.4.22 is 7 days old: update it then.

### Vulnerabilities without a fix

None recorded. The previous entry, GHSA-vfj7-8cjw-p6xm (`braces` 3.0.3 through stylelint), was withdrawn by the advisory database on 2026-10-23 as not practically exploitable, so the ignore in `auditConfig.ignoreGhsas` and `osv-scanner.toml` was removed with it.

### `overrides`

`qs` 6.16.0, `sharp` 0.35.5, `undici` 7.30.1 (wrangler and miniflare) and 8.12.2 (astro, through unifont), `zod` 4.6.7, `happy-dom` 21.0.4, `fast-uri` 3.1.9 and `minimatch` 11.0.1 (eslint, through `@eslint/config-array`) are raised to fixed versions; Stryker, wrangler, Vitest, Astro and eslint pull these packages in as transitive dependencies. The `glob` 14.0.3 override was removed on 2026-11-13: `@sentry/node` 11.11.0 (lighthouse) asks for `^14.0.3` itself, so GHSA-3g3m-2fjr-6pw4 stays fixed without it. All pinned releases are older than 7 days.

### Dependabot

`@types/node` major updates are ignored: the types must match the Node.js 24 LTS runtime.

Minor and patch updates arrive as one pull request per ecosystem (`npm-minor-and-patch`, `uv-minor-and-patch`, `actions-minor-and-patch`), so CI runs once for a week's updates instead of once per package. Major updates still come one per pull request.

### Gitleaks historical test fixtures

Four `generic-api-key` findings from commit `74e0a35870dc52bfd56a00a5ee3a4ac88a0845c9` are ignored by exact commit, path, rule and line fingerprints in `.gitleaksignore`: `apps/worker/test/node/env.node.test.ts:7` and `apps/worker/vitest.config.ts:30,31,36`. These are synthetic test-only values, not issued credentials; rewriting published history would be disruptive. Checked: 2026-10-26. Review: 2027-01-26, or sooner if test fixtures or the Gitleaks rule change. CI explicitly loads the ignore file from the repository mount and continues to scan the full history for every other finding.

### Gitleaks: the public IndexNow key

`INDEXNOW_KEY` in `packages/contracts/src/indexnow.ts` matches the `generic-api-key` rule. It is not a credential: the IndexNow protocol proves site ownership by having the engines fetch the same value from `https://<host>/<key>.txt`, which `apps/web/public/<key>.txt` serves to anyone. `apps/web/test/indexnow-key.test.ts` fails if the constant and the served file drift apart.

`.gitleaks.toml` extends the default rules (`useDefault = true`) with one allowlist entry whose conditions must all hold (`condition = "AND"`): rule `generic-api-key`, path exactly `packages/contracts/src/indexnow.ts`, and a secret exactly equal to the published key (`regexTarget = "secret"`, an anchored regex). The entry is not tied to a commit or a line, so it survives squash merges and also covers the introducing commit on the feature branch, which CI scans because the checkout fetches every branch. It is narrower than a commit-less `path:rule:line` fingerprint in `.gitleaksignore`, which would hide any value placed on that line.

Scope and consequences:

- any other value in that file, including a different key on the same line, is still reported;
- the same value in any other file is still reported;
- every other rule still applies to that file;
- rotating the key means updating the constant, the served file and the allowlist regex together; a missed regex makes the scan fail rather than pass.

Verified on 2026-11-02 with the pinned image (`zricethezav/gitleaks@sha256:c00b6bd0…`, gitleaks v8.30.1) on a local clone carrying every branch, using the CI command line:

- the full history, including the introducing commit, scans clean;
- a random 40-character value on the key's line is reported;
- the published key copied into another file is reported;
- without `.gitleaks.toml` the original finding comes back, which shows the file is picked up from the repository root without a flag.

Checked: 2026-11-02. Review: 2027-02-02, or sooner on key rotation, a Gitleaks image or rule update, or the stage 7 launch.

## Recorded new dependencies

New dependencies that follow the policy without an exception, recorded with the reason they were added.

| Package         | Where            | Reason                                                                                                                                                                                                                                                                                                                                                                                                                      | Checked    |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `pillow` 13.0.0 | `tools` (Python) | decodes archive photos and encodes the gallery's WebP variants for `zsm3-gallery-archive` ([gallery-archive.md](gallery-archive.md)); its wheels bundle libwebp 1.6.0. It parses untrusted images, so the tool allows six formats only, refuses images over the pixel limit and treats a decompression-bomb warning as an error. Resolved through uv under `exclude-newer = "7 days"`; OSV-Scanner reports no vulnerability | 2026-11-04 |

## Known scanner limitations

- **OSV-Scanner** reads only the first YAML document of a pnpm 12 `pnpm-lock.yaml` (15 internal packages). `.github/scripts/osv-scan.sh` extracts the last document (~1,000 packages) and fails if it has no `importers:` section.
- **actionlint** 1.7.12 does not know the `uses: $/...` self-repository syntax (GitHub, July 2026). One message is suppressed for `$/.github/actions/setup`; zizmor checks pinning of every other action.
- **Semgrep** rule `github-actions-mutable-action-tag` treats `$/...` as a mutable tag. The rule is disabled; zizmor's `hash-pin` policy covers the same risk more precisely.
- **Semgrep** audit rule `python.lang.security.audit.httpsconnection-detected` reports every `http.client.HTTPSConnection` call, because Python before 3.4.3 did not verify certificates by default. It is not a finding about the call itself. `tools` pins Python `>=3.13,<3.14`, and the only caller, `zsm3_tools.inventory_http.HttpTransport`, passes `ssl.create_default_context()` explicitly; a test asserts `CERT_REQUIRED`, hostname checking and TLS 1.2 or newer on that context. The rule is excluded in the Semgrep step; every other Python rule still runs. Checked: 2026-11-02. Review: 2027-02-02, or sooner on a Python, Semgrep image or rule update, or a new `HTTPSConnection` caller.
