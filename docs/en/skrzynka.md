# Skrzynka #OgarniamŻycie

Anonymous questions from students to the school pedagogue, psychologist and leadership.
Nothing a student sends is ever published automatically: a counsellor reads it in the panel,
decides whether it helps others, rewrites it so nobody can be recognised, answers it and only
then publishes the pair. This document is the technical reference; the staff guide in Polish is
[../pl/skrzynka.md](../pl/skrzynka.md).

The feature ships **switched off**. Production stays closed until the school approves the
items under [School approvals still required](#school-approvals-still-required).

## What it replaces

The legacy service under `/wp-content/uploads/ogarniamzycie/` (2024 student project) let a
student pick the pedagogue, psychologist or leadership, send a question, and promised that
every question would be published anonymously with an answer. Its rules page says questions
are not answered immediately, may be discussed among the specialists, are published only
without personal details, and that a threat to life or health may lead the school to act. The
new box keeps the three addressees and the moderated publication. It does not promise that
every question is published, and it never asks for a contact address. No code, copy or
historical submissions were taken from the legacy service.

## Flow

1. `/skrzynka` shows urgent help first (116 111, 112 and the school's help page), then how the
   box works, what happens to the data, the form, and the approved answers.
2. The form posts JSON to `POST /api/questions`, a separate Hono application
   (`apps/worker/src/questions-app.ts`) with an 8 KiB body limit, mounted by the web Worker.
3. The route answers `404` unless `SKRZYNKA_ENABLED` is exactly `true`. It then requires a
   same-site `Origin` and a JSON body, and passes the body to `submitQuestion`:
   - an HMAC rate-limit bucket (`question:` + IP, salted with `RATE_LIMIT_SALT`), at most 3
     questions per 10 minutes;
   - Turnstile with action `question`, verified against the request hostname and a fresh
     challenge timestamp, **without** sending the student's IP to Cloudflare;
   - `questionInputSchema` (strict, so extra fields such as an e-mail address are refused),
     an empty honeypot, and at least 5 seconds between page load and send.
4. A valid question is stored with status `received`, encrypted, and answered with
   `202 {"received": true}`. The response carries nothing the student could use to follow the
   question, so there is no status page, no token and no conversation.
5. A counsellor opens `/panel/skrzynka`, reads the decrypted question, writes a redacted
   version and an answer as a draft, and publishes. The public pages read only the published
   columns.

## Data model

Migration `0016_questions.sql` creates the table and rebuilds `staff` to add the
`counsellor` role.

```
questions
  id TEXT PK                 random UUIDv4 (no timestamp inside, unlike the other tables)
  addressee                  pedagogue | psychologist | leadership
  status                     received | draft | published | rejected | withdrawn
  version INTEGER            starts at 1, +1 on every staff write (optimistic concurrency)
  question_ciphertext BLOB   AES-GCM of the student's text, AAD "question:<id>"; NULL after publication
  question_key_id
  draft_ciphertext BLOB      AES-GCM of {question, answer} written by staff, AAD "draft:<id>"
  draft_key_id
  public_slug UNIQUE         12 characters from a-k m n p-z 2-9, assigned at first publication and kept
  published_question, published_answer, published_on   plaintext, present only while published
  form_key UNIQUE            random per page load in the browser; makes a resend idempotent
  received_on                day only (YYYY-MM-DD), no time of day
  changed_at NULL            time of the last staff write
  CHECKs: published ⇔ public texts present; published ⇒ slug and draft; received ⇒ question;
          ciphertext ⇔ key id
```

Keys are the existing `PII_KEY_PRIMARY` / `PII_KEY_SECONDARY` pair through `piiCrypto`, so key
rotation works as it does for e-wniosek. Additional data binds each ciphertext to its row and
purpose, so a draft cannot be passed off as a question or moved to another row.

### Migration order

`0016_questions.sql` does not touch the tables of the open pull requests:

- #72 adds `0014_gallery.sql`;
- #73 adds `0014_short_link_files.sql`, which is expected to be renamed to `0015_…` when it is
  integrated.

Wrangler applies unapplied migrations in name order and records each name, so `0016` may land
before or after either of them. The one shared object is `staff`: `0016` rebuilds it with the
same columns and adds `counsellor` to the role check. A later migration that rebuilds `staff`
again must keep `counsellor` in its check.

## Moderation

| Change     | Allowed from                         | Result                                                               |
| ---------- | ------------------------------------ | -------------------------------------------------------------------- |
| `draft`    | received, draft, withdrawn           | `draft`; stores the encrypted redacted question and answer           |
| `publish`  | draft (with a non-empty answer)      | `published`; copies the draft to the public columns, erases original |
| `reject`   | received, draft, withdrawn           | `rejected`; never shown, deleted after 30 days                       |
| `withdraw` | published                            | `withdrawn`; public columns cleared at once, draft kept for editing  |
| `delete`   | received, draft, rejected, withdrawn | row removed; a published question must be withdrawn first            |

The rules live in `apps/worker/src/domain/question-lifecycle.ts`. Every write sends
`expectedVersion`. The batch runs an audit insert guarded by `id` and `version`, then the
`UPDATE … WHERE id = ? AND version = ?`. Two moderators acting on the same version therefore
get one success and one `409 Question Changed`, and only the winner is recorded in
`audit_log`. The panel keeps the moderator's unsaved text on a draft conflict and reloads the
question after a decision conflict. It also refuses to publish while the editor holds unsaved
changes, so what gets published is always what was saved and reviewed.

API (all JSON, all behind Cloudflare Access, `Origin` checked on writes):

| Route                                    | Name               |
| ---------------------------------------- | ------------------ |
| `GET /api/panel/questions`               | `questions.list`   |
| `GET /api/panel/questions/:id`           | `questions.get`    |
| `PUT /api/panel/questions/:id/draft`     | `questions.draft`  |
| `POST /api/panel/questions/:id/decision` | `questions.decide` |

Only the `counsellor` role reaches these routes. Each account has one role, so an
administrator can assign the role to a counsellor's account but cannot read questions. The matrix test calls each route with every role.
The audit log records the action, the staff member and the changed field names, never the
text.

## Privacy and safeguarding decisions

- **No identifying data is collected.** There are no name, class, e-mail, telephone or
  account fields; the strict schema refuses them if a script adds them. The form tells the
  student not to sign or name anyone.
- **No IP address or device data at rest with the question.** The question row holds the
  addressee, day, ciphertext and moderation state. The rate-limit table holds an HMAC of the
  IP and a window start for at most 24 hours, as for e-wniosek; it is not linked to any
  question. Turnstile receives no `remoteip`. The browser sends without cookies or referrer.
- **The time of day is not stored.** It could point to one class or one computer room, so the
  queue is ordered by day and the id is random.
- **Encryption at rest.** The student's text and every draft are encrypted with the
  e-wniosek key pair. The plaintext columns hold only what a counsellor chose to publish.
- **Publication erases the original.** Only the redacted published version and the draft
  remain.
- **Retention.** Unanswered (`received`, `draft`) questions are deleted 90 days after the
  last activity; `rejected` and `withdrawn` ones 30 days after the decision. The cutoff uses
  the start of the received day, so the deletion is never later than the stated period. The
  15-minute cron prunes in batches of 100. Published pairs stay until a counsellor withdraws
  them.
- **Safe rendering.** Text is plain text everywhere. Astro escapes it on public pages, the
  panel sets `textContent`, and the schema refuses control and direction-override characters.
  There is no markup, no links and no `innerHTML`.
- **No exposure through search or feeds.** Every page under `/skrzynka` is `noindex` (the
  listing shows answer excerpts), and none of them is in the XML sitemap, RSS or IndexNow; the
  HTML site map and the site search only point to `/skrzynka` itself. The question routes never
  call IndexNow. Pages are not cached at the edge
  ([ADR 0003](adr/0003-no-edge-cache-for-pages.md)), so a withdrawal is visible at once.
- **Logs.** The structured logger has no event that carries question text; an unexpected
  failure logs only the error name.
- **No automated decisions.** Nothing is classified, scored or answered automatically, and
  no AI is involved anywhere in the flow.
- **Not a crisis service.** The page says plainly that nobody reads questions in real time and
  that a reply may take days or never come. Urgent help (116 111, 112, adults in school) is
  shown above the form, on every answer and after sending.

### Urgent or concerning questions

The box cannot identify a student and must not try to. When a question suggests that someone
is in danger, the counsellor does not answer it in the box. Instead they follow the school's
child-protection standards (_Standardy ochrony małoletnich_) and alert the person responsible
for them at once. They then reject the question so it is never published, and record what was
done in the school's own safeguarding records. The 30-day deletion of rejected questions
means the panel is not a record-keeping system for such cases.

## Enabling it

Set `SKRZYNKA_ENABLED=true` as a Worker variable together with the existing
`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_SALT` and `PII_KEY_PRIMARY`. The page
reads the flag and the site key at request time, so switching it off needs no rebuild. Then:

1. create the Turnstile widget with the `question` action allowed for the site hostname;
2. give the approved staff members the `counsellor` role in `/panel/pracownicy`;
3. check `/skrzynka` shows the form and `/panel/skrzynka` the empty queue.

With any secret missing the endpoint answers `503`. With the flag off the endpoint answers
`404` and the page says the box is closed, but published answers stay visible.

Locally and in CI's end-to-end job, `.dev.vars` carries `SKRZYNKA_ENABLED=true`, a random
`PII_KEY_PRIMARY` and Cloudflare's always-passing test site key; the seed then adds two
synthetic published answers and one queued question. The browser tests replace the Turnstile
script and the API with fakes, while the real endpoint is tested in the Node and workerd
suites.

## School approvals still required

- Whether the box runs at all, and who the moderators are (site plan, open question 3).
- The safeguarding procedure for concerning questions and the person responsible for it,
  under the school's child-protection standards.
- The public wording of the page, including the help numbers, and whether further services
  should be listed.
- The retention periods (90 days unanswered, 30 days rejected or withdrawn), with the data
  protection officer, and a privacy-notice entry for the box.
- Whether `/skrzynka` and the published answers should ever be indexed by search engines
  (currently `noindex`).
