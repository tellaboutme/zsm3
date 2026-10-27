# ZSM3 — Personal-data incident runbook

Status: **draft prepared for stage 4 (e-wniosek).** Before the form is opened to real applicants (stage 7), verify every switch below against the school's Cloudflare, Brevo and GitHub accounts and fill in the contact list. This file is referenced from [architecture, §12.3](en/architecture.md); notification templates for the school (in Polish) live in [`pl/runbook-notification.md`](pl/runbook-notification.md); vulnerability reports come in through [`../SECURITY.md`](../SECURITY.md). The school's register of processing activities (`docs/RODO.md`) is planned for stage 7.

## 1. Scope

Personal data handled by the platform and by this runbook:

| Where                                | What                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| D1 `requests`                        | applicant data: one encrypted JSON blob per row (AES-256-GCM), HMAC index of the e-mail, status-token hash |
| D1 `email_outbox`, `outbox_failures` | pending and failed e-mail (request id, type, status link only; no personal data by design)                 |
| D1 `staff`, `audit_log`              | staff e-mails, roles, panel actions (migration `0005_staff.sql`)                                           |
| Secrets                              | the Worker secrets of section 6, the deployment token, the Brevo API key                                   |
| Logs                                 | Workers Logs (typed events only, no personal data), Cloudflare notifications, GitHub audit logs            |

Leak of content data (news, pages, files) without personal data is a defacement or availability incident: it follows the same reporting rhythm but not the RODO 72-hour track.

## 2. What counts as an incident

Per RODO art. 4(12): each loss of confidentiality, integrity or availability of the data in scope. Concretely:

1. D1 data or a D1 export leaves its usual place (a shared dump file, a wrong bucket, a screenshot with applicant data).
2. A Worker secret becomes readable to an outsider (leaked into a log, a fork, a terminal transcript, a support chat).
3. Compromise of the school's Cloudflare, Brevo or GitHub account.
4. Live status links leak without the owner's action (tokens themselves are hashed at rest, so a D1 dump alone does not reveal them).
5. A malicious or hijacked dependency reaches production (supply-chain gates in [`en/supply-chain.md`](en/supply-chain.md)).
6. A credible report through GitHub security advisories or any other channel mentioning applicant personal data.

Not incidents by themselves: `429`/`403`/`409` refusals (bot defenses: 5 submissions per 10 minutes, at most 3 open requests per e-mail, Turnstile), transient `5xx`, a dead-letter row with a known cause.

## 3. Detection signals

What exists in the code today (verify the dashboards once the school's Cloudflare account is live):

| Signal                        | Source                                                            | Note                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Typed log events              | `apps/worker/src/logging/log.ts`                                  | only `unhandled_error`, `turnstile_unavailable`, `outbox_enqueue_failed`; never personal data               |
| Dead-letter rows              | D1 `outbox_failures` (`request_missing`, `recipient_unavailable`) | the outbox drains every 15 minutes, at most 20 messages per run; until the alert is wired, check it by hand |
| Security reports              | GitHub security advisories (see `SECURITY.md`)                    | answer within 5 working days; reports about applicant personal data are incidents by definition             |
| Retention heartbeat           | D1 `cron_state`, job `retention`                                  | the date must move once a day; a frozen date means the scheduled job is dead                                |
| Cloudflare notifications/logs | dashboard                                                         | error notifications and Workers Logs retention are short; pull evidence quickly                             |

## 4. First hour: facts before switches

Answers first, actions next. Keep an incident log locally (UTC ISO 8601 timestamps, like the database); `audit_log` is not the place for incident notes.

1. Time and channel of detection; who else knows.
2. Which systems and which data could have been read (tables and buckets, a rough row count is enough).
3. Which credentials are known or guessed to be compromised.
4. Evidence preserved: log excerpts, notifications, screenshots, the request ids if the source names any.

Then decide. If uncertain, treat it as an incident — it is cheaper to close a false alarm than to miss a 72-hour deadline. **Notify the IOD immediately after classification.** The school is the controller; the deadlines in section 8 belong to the IOD, not to the person running `wrangler`.

## 5. Containment (first 30 minutes)

Isolate first, one lever per ring, and undo them in the opposite order when the danger is over.

| Lever                            | How                                                                                                                                             | Effect                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Block the public request API     | Cloudflare dashboard → Security → WAF → custom rule: field `http.request.uri.path`, operator `starts with`, value `/api/requests`, action Block | instant, reversible, no deploy; `POST /api/requests`, `/status` and `/withdraw` all stop answering                                                                      |
| Block the whole site (mass leak) | same place, rule on `http.request.uri.path` `starts with` `/`, action Block (or the "Under attack" page rule)                                   | kills all browsing; only for a confirmed compromise of live data                                                                                                        |
| Stop the API from the terminal   | from `apps/web`: `wrangler secret delete TURNSTILE_SECRET_KEY` — any secret listed in section 6 works                                           | every `/api/requests` route answers `503` (the missing configuration fails closed); the content site keeps working; the maintenance cron stops until the secret is back |
| Shut the staff panel             | Zero Trust → Access → Applications: disable the panel application                                                                               | the panel UI still loads, but every `/api/panel/*` call answers `401` — the panel is unusable; the Worker never trusted Access alone                                    |
| Hide the form in the UI          | build with `REQUESTS_ENABLED=false` and deploy; `/e-wniosek` then shows "Wnioski online są niedostępne" with the secretariat contact            | hides the form only; the API keeps running — always pair it with the WAF rule                                                                                           |

`wrangler` commands run from `apps/web` against the deployed Worker `zsm3`; a secret change takes effect on the next request without a redeploy. Verify from the outside: `curl -i -X POST https://<domain>/api/requests/status -H "Content-Type: application/json" -d '{"token":"x"}'` must come back from Cloudflare (`403`) or as the API's `503` — a `201`/`200` means the rule did not take effect.

## 6. Rotate secrets and tokens

The names come from `apps/worker/src/env.ts`. Every one is required; the key material (`PII_KEY_*`, `EMAIL_INDEX_KEY`, `RATE_LIMIT_SALT`) needs at least 32 characters:

| Secret                 | What it protects                                    | Rotated where                                 |
| ---------------------- | --------------------------------------------------- | --------------------------------------------- |
| `PII_KEY_PRIMARY`      | applicant data (AES-256-GCM per row, row id as AAD) | `wrangler secret put`                         |
| `PII_KEY_SECONDARY`    | reserve slot to decrypt rows keyed `SECONDARY`      | `wrangler secret put`                         |
| `EMAIL_INDEX_KEY`      | HMAC index for the open-request limit               | `wrangler secret put`                         |
| `RATE_LIMIT_SALT`      | HMAC of the client IP for rate-limit keys           | `wrangler secret put`                         |
| `TURNSTILE_SECRET_KEY` | Turnstile siteverify                                | Turnstile console, then `wrangler secret put` |
| `TURNSTILE_SITE_KEY`   | public site key of the same pair                    | Turnstile console, then rebuild               |
| `BREVO_API_KEY`        | outgoing e-mail (Brevo)                             | Brevo console, then `wrangler secret put`     |

Outside the Worker: the Cloudflare API token used for deployments (GitHub environment `production`), the Access application's identity provider settings (Zero Trust) and the Brevo account itself. Nothing here is stored in the repository — gitleaks and GitHub secret scanning guard that, and a leak of any of these files offends paragraph 2 above.

PII keys have exact semantics (see `security/pii-crypto.ts`): new rows are always encrypted under `PII_KEY_PRIMARY`; `PII_KEY_SECONDARY` exists only so that rows whose `pii_key_id` is `SECONDARY` stay readable. Therefore:

- Where the key itself leaked, replace `PII_KEY_PRIMARY` with fresh random material. Old ciphertext stays stored but unreadable — the intended outcome; the panel and the e-mail consumer skip such rows silently (`PiiDecryptionError` is treated as "recipient unavailable" and lands as a dead-letter row).
- If the data must remain readable after a rotation, a re-encryption step is needed first. It does not exist yet: agree on it with the IOD and file the work (a maintenance job re-keying rows by `pii_key_id`) before rotating.
- `EMAIL_INDEX_KEY`: after a rotation old rows no longer match the dedupe limit (their HMAC values changed); nothing breaks, the limit simply starts fresh. Recomputing old indices would need code — note it as a follow-up.
- `RATE_LIMIT_SALT`: after a rotation the old entries in `rate_limits` are orphans; the cron prunes them within 24 hours.
- Status tokens: 32 random bytes, stored only as a SHA-256 hash; a database dump does not reveal them. A leak of live tokens (for example a stolen mailbox of an applicant) is contained by the WAF rule and by erasing `status_token_hash` for the affected rows, which invalidates the link at the next status check.

## 7. Remove or restore data in D1

The request tables (migration `0004_requests.sql`): `requests`, `email_outbox`, `outbox_failures`, `rate_limits`, `cron_state`. Applicant data lives only in `requests` (`pii_ciphertext`, `pii_key_id`, `email_index`, `status_token_hash`).

1. Evidence first: `wrangler d1 export zsm3 --remote --output incident-evidence.sql` (the same command shape as the weekly backup in architecture §12.3). The export contains ciphertext and hashes; store it where the IOD decides and destroy it when the case closes.
2. Count before touching: `wrangler d1 execute zsm3 --remote --json --command "SELECT status, count(*) FROM requests GROUP BY status"` and, for the blast radius, `SELECT count(*) FROM requests WHERE pii_erased_at IS NULL`.
3. Erase the way the application does it (mirror of `storage/requests-cleanup.ts`, `eraseAndCancel`), per request id, in one batch:

   ```sql
   UPDATE requests
      SET pii_ciphertext = NULL, pii_key_id = NULL, email_index = NULL,
          pii_erased_at = '<UTC now>'
    WHERE id IN ('<id>', '<id>');

   DELETE FROM email_outbox WHERE request_id IN ('<id>', '<id>');
   DELETE FROM outbox_failures WHERE request_id IN ('<id>', '<id>');
   ```

4. To remove the anonymous remains of a closed case entirely, delete the `requests` row as well — the scheduled cleanup does exactly that two years after erasure (`ANONYMOUS_RETENTION_YEARS`). An out-of-turn row deletion is an IOD decision, not a tidy-up.
5. Restoring: D1 Time Travel (dashboard) can replay any point of the last 30 days. Never restore blindly over an incident: a restore from before the breach resurrects whatever leaked. Use it for proven integrity damage only, into a fresh database after the IOD agrees, and wipe the old one afterwards.
6. Verify: repeat the counts of step 2; the `pii_ciphertext IS NULL` half must match the erasure decision.

## 8. Notifications (the school's part)

The school is the controller; the IOD decides and signs. The developer's duty is the facts and the technical timeline, immediately.

| When                | Who                                                                                                                          | What                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| On triage           | IOD                                                                                                                          | the classification log from section 4; nothing waits for the containment to finish                         |
| Without undue delay | any processor involved (Brevo, a Cloudflare support case, a developer with production access under the processing agreement) | the processor must tell the school what happened and when; ask for it in writing                           |
| ≤ 72 hours          | UODO (Prezes Urzędu Ochrony Danych Osobowych)                                                                                | art. 33 RODO notification unless the risk to rights is unlikely; template `pl/runbook-notification.md` § B |
| High risk to rights | affected applicants                                                                                                          | art. 34 notification in plain Polish; template § C; the secretariat answers questions by phone             |

The 72-hour clock starts when the school becomes aware of the breach; the IOD notes that moment in the incident log. If facts are incomplete at hour 72, notify with what is known and update the filing — art. 33(4) allows phased notifications.

## 9. Recovery and closing

1. Secrets back in place (`wrangler secret list` matches the table in section 6; a missing required secret keeps the request API dark on its own).
2. Keys rotated and the affected rows erased per section 7; the dead-letter rows drained or accepted.
3. The WAF rule is disabled last, after a successful end-to-end check on the preview environment: form → confirmation e-mail → status page → panel move to `in_progress`. No test rows on the production database.
4. The incident log, the evidence export and the notification copies stay with the IOD; they land in the school's records when the case closes.

## 10. Postmortem

Within a week, blameless, written and shared with the school. Mandatory content: the UTC timeline; why detection worked or did not; which defense of architecture §8.1 failed or was missing; what changed (WAF rules, secrets, tokens, code); follow-ups with owners and dates.

Update the standing documents while it is fresh:

- this runbook (stale commands, wrong contact roles, missing signals);
- [`en/supply-chain.md`](en/supply-chain.md) — if the cause was a supplier or dependency, record the tightening in the policy and exception tables before lifting any gate;
- the threat-model row in [`en/architecture.md`](en/architecture.md) if a new risk needs its mitigation;
- `docs/RODO.md` (stage 7): the incident entry for the school's own records.

## 11. Contacts (fill in before launch)

Roles only — never put names, personal phone numbers or addresses in this public repository; keep them in the school's password manager and verify them once a year.

| Role                                                                       | Needed for                                                    | Contact       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------- |
| School's data protection officer (IOD)                                     | classification, UODO notification, subject notifications      | `[[fill in]]` |
| Cloudflare account administrator (the school)                              | WAF rules, secrets, logs, Time Travel, Access                 | `[[fill in]]` |
| Brevo account administrator (the school)                                   | sending lock, API key rotation, sender logs                   | `[[fill in]]` |
| Deployment maintainer (has production access; processing agreement signed) | `wrangler` commands, deploys, code reads                      | `[[fill in]]` |
| GitHub organisation owner                                                  | secret scanning, advisories, audit logs, collaborator removal | `[[fill in]]` |
| Secretariat duty officer                                                   | applicant questions during the art. 34 notification           | `[[fill in]]` |
| UODO contact channel                                                       | only the IOD files; everyone else drafts and passes facts     | via the IOD   |
