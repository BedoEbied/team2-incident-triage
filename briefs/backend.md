# BRIEF — Backend API (branch `backend`)

You are building the backend for **Team 2**'s competition entry: an AI-powered incident and
log triage dashboard. You have roughly **25 minutes**. Work only in your current directory.

Read `contract/api.md`, `contract/types.ts` and `contract/tokens.ts` first. They are frozen.

## Stack

Node 22 + TypeScript (`strict: true`) + Express + `better-sqlite3` + `tsx` + `bcryptjs` +
`jsonwebtoken` + `multer`. Port **4000**, bind **`0.0.0.0`**. SQLite file at `data/triage.db`,
schema created with inline `CREATE TABLE IF NOT EXISTS` — no ORM, no migration tool.

`npm run dev` must start the server and seed on boot.

## Layout — build in this order

```
src/
  domain/types.ts        re-export contract/types.ts (copy it in)
  domain/ports.ts        LogParser, Analyzer, IncidentRepo interfaces
  infra/winston-parser.ts    implements LogParser
  infra/fingerprint.ts       normalize() + grouping
  infra/rule-analyzer.ts     implements Analyzer
  infra/sqlite.ts            implements IncidentRepo
  app/ingest.ts app/list.ts app/stats.ts app/auth.ts app/incidents.ts
  http/routes.ts http/auth.ts http/errors.ts
  container.ts           the ONLY place that calls `new`
  index.ts
  seed.ts                ingest fixtures/logs/*.log on boot
```

SOLID rules that are graded: parse ≠ group ≠ analyze ≠ persist (SRP); `LogParser` and
`Analyzer` are interfaces so a second implementation drops in without touching callers
(OCP/DIP); `domain/` imports nothing from `infra/` or `http/`; `new` appears only in
`container.ts`.

---

## THE LOG FORMAT — the hardest part, read carefully

Source files are already at `fixtures/logs/*.log` (5 files, 5.0 MB, **893 entries**).

They are **not JSON and not line-delimited**. They are Node `util.inspect` dumps from Winston.
One entry is a block that starts with `{` at **column 0** and ends with `}` at **column 0**.

```
{
  name: 'Error',
  stack: 'Error: A location with locationId TUPSS23604 was not found.\n' +
    '    at SterlingSchedulingService.requestAsync (/home/ibrahim/apps/sterling-integration-api/src/services/integrations/sterling-scheduling-service.ts:107:27)\n' +
    '    at Task.handleOverLapping (/home/ibrahim/apps/sterling-integration-api/src/tasks/task.ts:87:17)',
  message: 'A location with locationId TUPSS23604 was not found.',
  error: 'A location with locationId TUPSS23604 was not found.',
  code: 'SterlingNotFound',
  level: 'error',
  timestamp: '2026-05-19 09:22:24'
}
```

### Parser rules — follow exactly

1. **Stream it.** Use `readline` over a read stream, accumulate lines, flush the block on a `}`
   at column 0. Never `readFileSync` the whole file.
2. **Never `JSON.parse` and never `eval`** a block. This is untrusted input. Use anchored regexes.
3. Fields are at two-space indent: `^  key: '...'`. Values may be single- or double-quoted
   (the quote style flips depending on whether the message contains an apostrophe).
4. **`stack` spans multiple lines** joined with `' ... \n' +`. Rejoin every quoted continuation
   segment until a segment is not followed by `+`, then unescape `\n`.
5. **`message` is sometimes a nested object**, i.e. the line reads `  message: {`. When it does,
   descend one level: use the inner `message` if non-empty, otherwise the inner `error`. Take
   `code` from the inner block too. Roughly 6 entries hit this path.
6. `timestamp` is `'YYYY-MM-DD HH:mm:ss'` with **no timezone** — treat as UTC and emit ISO 8601.
7. **`module`** = the first stack frame whose path contains `/src/` and does *not* contain
   `node_modules` (this drops sequelize/mysql2 internals). Store it as the path from `src/`
   onward, e.g. `src/services/integrations/sterling-service.ts`. Also capture the frame's
   symbol, e.g. `SterlingSchedulingService.requestAsync`.
8. A file that yields **zero** parseable blocks must produce HTTP 400 `UNSUPPORTED_LOG_FORMAT`.

### Grouping — do this BEFORE any analysis

This is the core design idea: 893 entries collapse to **10 incidents**, so analysis runs
once per incident rather than once per entry.

```
fingerprint = sha1(normalize(message)).slice(0, 12)
```

`normalize()` applies these substitutions in order:

| pattern | replacement |
|---|---|
| UUID v4 | `<uuid>` |
| `\b\d{1,3}(\.\d{1,3}){3}(:\d+)?` (IP, optional port) | `<ip>` |
| `\b[A-Z]{3,}\d{3,}\b` (ids like `TUPSS23604`) | `<id>` |
| `\bnull\b` | `<id>` |
| `\b\d{3,}\b` | `<n>` |

The `null` rule matters: it collapses `locationId TUPSS23604` and `locationId null` into one
incident of 39. Do not skip it.

Group by fingerprint only — **not** by module or code. A message that fires from two call
sites is one incident with two entries in `modules[]`. Per incident derive: `occurrences`,
`firstSeen`/`lastSeen`, `module` (most frequent), `modules[]` (all), `code` (most frequent
non-null), and `similarity` (share of members sharing the modal normalized message).

### GOLDEN NUMBERS — your parser is wrong unless these hold

- Total parsed entries: **893**
- Per file: `2026-04-23.log` 449, `2026-05-04.log` 257, `2026-05-16.log` 110, `2026-05-19.log` 25, `2026-05-20.log` 52
- Incidents after grouping: **10**
- Largest incident: **661** occurrences, `Cannot read properties of undefined (reading 'access_token')`
- Occurrences across all incidents sum to **893**
- Date span: `2026-04-23` → `2026-05-20`

Write these as assertions in `seed.ts` and print them on boot. Get the parser green before
writing any HTTP route — everything else depends on it.

---

## Analyzer — rule-based only

Every log line is `level: 'error'`, so severity **cannot** be read off the level. It is derived.

Implement `Analyzer` with a rule table matched **in order against the normalized message**,
first hit wins. `{1}` in any text field interpolates the first regex capture group.
`contract/mock.json` was generated with exactly this table — match it so the live API and the
mock agree.

| match (regex, case-insensitive) | severity | title | confidence |
|---|---|---|---|
| `access_token` | Critical | `Sterling auth token missing from integration response` | 0.94 |
| `Unknown column '([^']+)' in 'field list'` | High | ``Schema drift: column `{1}` missing from database`` | 0.91 |
| `A location with locationId .* was not found` | Medium | `Location lookup failing for unknown or null external IDs` | 0.87 |
| `valid latitude and longitude or searchTerm` | Medium | `Scheduling search called without coordinates or search term` | 0.89 |
| `ETIMEDOUT` | High | `Connection timeouts reaching the Sterling API` | 0.82 |
| *(no match)* | Low | `Unclassified application error` | 0.4 |

Take the full `summary`, `rootCause` and `remediation` strings for each rule verbatim from the
corresponding incident in `contract/mock.json` — they are already written and reviewed.

Keep `Analyzer` an interface with the rule engine as one implementation. An LLM-backed
implementation is explicitly **out of scope** for this build; leave the seam, not the code.

---

## Persistence

Tables: `user`, `log_file`, `log_entry`, `incident`, `activity`.

Every status change, assignment, acknowledgement and note writes an `activity` row — the
mobile app renders incident history from it.

Re-ingesting a file must upsert onto the existing `fingerprint`, not duplicate incidents.

## Auth

`user` table, `bcryptjs` hash, `jsonwebtoken` HS256, 24h expiry. Seed
`oncall@demo.io` / `demo1234` with name `On-Call Engineer`. Bearer middleware on every route
except `POST /auth/login` and `GET /health`.

## Uploads

`POST /uploads` accepts multipart with a repeatable `files` field, returns `{ jobId }`
immediately, and processes in the background (an in-process async task is fine — no queue).
`GET /uploads/:jobId` reports `status`, `progress` 0–100, `parsed`, `grouped`. A file with zero
parseable blocks fails the job and returns `UNSUPPORTED_LOG_FORMAT` on the upload call.

## Seed on boot

Ingest all five `fixtures/logs/*.log` at startup if the database is empty, so both clients have
real data the moment they connect. The demo must not depend on a live upload.

## Minute budget

| min | deliverable |
|---|---|
| 0–7 | scaffold, sqlite schema, auth, `/health` |
| 7–15 | parser + fingerprint grouper, seed asserting 893 / 10 / 661 |
| 15–21 | rule analyzer, `/incidents`, `/incidents/:id`, `PATCH`, notes, `/stats` |
| 21–25 | upload job + progress + `UNSUPPORTED_LOG_FORMAT` |

## Acceptance

1. `curl localhost:4000/api/health` → `{"ok":true}`
2. Login with the seeded credentials returns a token
3. Boot log prints **893 entries, 10 incidents**
4. `GET /incidents` includes the **661**-occurrence Critical incident
5. `GET /stats` — `bySeverity` sums to 10; `trend` has points inside 2026-04-23…2026-05-20
6. `PATCH /incidents/:id {status:"Investigating"}` persists and writes an `activity` row
7. `npx tsc --noEmit` is clean

---

## Standing instructions

Work only inside your current working directory. **Do not modify `contract/`** — it is frozen;
if the API disagrees with it, fix your own code. Commit to the current branch as you go with
small messages. If blocked, write your best working approximation and record the blocker in
`NOTES.md` rather than stopping. Do not run `git push`, `git merge`, `git rebase`, or touch
other branches. Do not add an LLM/API-key dependency — the rule engine is the shipped analyzer.
