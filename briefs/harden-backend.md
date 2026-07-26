# HARDENING PASS — Backend API (branch `backend`)

The API is built, committed, `npm test` passes the golden assertions and `tsc --noEmit` is clean.
An independent 12-check smoke test against the running server also passes. This is a correctness,
security and polish pass — **not a rewrite**. Do not restructure working code. Commit in small,
separate commits.

`contract/` remains frozen — do not edit it.

---

## Defects and gaps to address first

### 1. Two incidents share the title "Connection timeouts reaching the Sterling API"

The `ETIMEDOUT` rule matches both `connect ETIMEDOUT <ip>` and `read ETIMEDOUT`. These are
different failures — one is a failure to establish a connection, the other a failure to read from
an established one — and they are correctly two separate incidents, but the identical title makes
the dashboard look like it has a duplicate-grouping bug.

Split the rule so the title distinguishes them, e.g. `Connection timeouts reaching the Sterling
API` vs `Read timeouts on established Sterling connections`, with root causes and remediations
that differ accordingly. Keep the interpolation mechanism already in place.

### 2. Confirm no entry is silently dropped

An earlier iteration dropped 3 blocks whose nested `message` and `error` were both empty. That
is fixed, but make the invariant explicit and permanent:

- Assert in `tests/parser.test.ts` that **parsed blocks == emitted entries** for every fixture
  file, not just the totals. A block that opens with `{` at column 0 and closes with `}` at
  column 0 must always produce exactly one entry, whatever its field contents.
- Keep the per-file assertions: 449 / 257 / 110 / 25 / 52, total **893**, **10** incidents,
  largest **661**.

### 3. Timestamps

Timestamps in the source logs have no timezone and are treated as UTC. That is correct — keep it.
Confirm every emitted `firstSeen` / `lastSeen` is ISO 8601 with an explicit `Z`, and that `/stats`
buckets `trend` by **UTC** date. The web client is being fixed to render in UTC to match; do not
change the backend to local time.

---

## Security — this service ingests untrusted input

Log files are attacker-influenced text. Verify each of these and fix anything that fails:

- **Uploads**: enforce a maximum file size and a maximum file count in `multer`, and cap the
  number of entries ingested per request. A 500 MB upload or a file of a million single-line
  blocks must not exhaust memory or disk. The parser already streams — confirm nothing downstream
  accumulates the whole file in an array before writing.
- **Path handling**: the uploaded filename must never be used to build a filesystem path. Store
  under a generated id and keep the original name only as a display string.
- **SQL**: confirm every query is parameterised. `better-sqlite3` prepared statements with bound
  parameters only — no string interpolation of user or log-derived values anywhere.
- **Auth**: the JWT secret must come from the environment with a clear failure if unset in
  production, not a hard-coded default. Confirm bcrypt cost is sane and that login does not leak
  whether an email exists (same error and similar timing for unknown email vs wrong password).
- **Error responses**: no stack traces or SQL text in HTTP error bodies. Log them server-side,
  return the contract's `{ error: { code, message } }` shape only.
- Confirm no log content is ever `eval`'d, `Function`-constructed, or `JSON.parse`d as code.

---

## General sweep

**Correctness**
- Re-ingesting the same file upserts on `fingerprint` and does not duplicate incidents or double
  the occurrence counts. Test this explicitly — ingest twice, assert 893 and 10 both times.
- `PATCH /incidents/:id` validates `status` against the enum and returns `VALIDATION_ERROR` for
  anything else, rather than writing an arbitrary string.
- Every mutation writes exactly one `activity` row; no duplicates, no missing history.
- Upload jobs reach a terminal state (`done` or `failed`) in every path, including a mid-file
  parse crash. A job stuck at `analyzing` forever is a bug.

**Contract conformance**
- Re-read `contract/api.md` end to end and verify every endpoint, query parameter, field name and
  error code matches exactly. Pay attention to `modules[]`, `similarity`, `confidence`,
  `acknowledged` and `assignee` being present on every incident.
- Confirm `GET /incidents` honours all of `q`, `severity`, `status`, `module`, `from`, `to`,
  `sort`, `order`, including multiple comma-separated severities and statuses at once.

**Architecture** (graded — keep the seams intact)
- `domain/` must import nothing from `infra/` or `http/`.
- `new` appears only in `container.ts`.
- `LogParser` and `Analyzer` remain interfaces with implementations behind them.

**Hygiene**
- No `any` crossing a module boundary. No dead code, no commented-out blocks, no stray
  `console.log` outside intentional boot output.
- `npm run dev` boot output stays useful and quiet: the seed line and the listening line.

---

## Verification before you finish

1. `npm test` passes, including the new "no dropped blocks" and "double-ingest is idempotent"
   assertions
2. `npx tsc --noEmit` exits 0
3. `npm run dev` prints `Seeded 893 entries, 10 incidents`
4. `bash ../incident-triage/scripts/smoke.sh` — all checks pass
5. `GET /incidents` shows two distinctly-titled timeout incidents
6. An oversized or malformed upload returns a clean 400, never a stack trace

Report what you changed, what you found and deliberately left alone, and any security issue you
could not fix.

---

## Standing instructions

Work only inside your current working directory. **Do not modify `contract/`.** Commit as you go
with small messages. If blocked, write your best working approximation and record the blocker in
`NOTES.md` rather than stopping. Do not run `git push`, `git merge`, `git rebase`, or touch other
branches. Do not add an LLM/API-key dependency — the rule engine remains the shipped analyzer.
