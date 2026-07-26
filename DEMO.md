# Team 2 — Demo Script & Requirements Traceability

Repo: https://github.com/BedoEbied/team2-incident-triage

Three branches, three deliverables, demoed from three git worktrees running at once.

---

## 0. Setup (before judges are watching)

```bash
git clone https://github.com/BedoEbied/team2-incident-triage.git && cd team2-incident-triage
git worktree add ../triage-backend backend
git worktree add ../triage-web frontend
git worktree add ../triage-mobile mobile
```

Three terminals:

```bash
cd ../triage-backend && npm i && npm run dev
```

```bash
cd ../triage-web && npm i && npm run dev
```

```bash
cd ../triage-mobile && npm i && npx expo start
```

Login everywhere: **`oncall@demo.io` / `demo1234`**

Sanity check before presenting:

```bash
bash scripts/smoke.sh
```

All 12 checks must pass. Backend boot must print `Seeded 893 entries, 10 incidents`.

---

## 1. Opening line (30 seconds)

> "On-call engineers don't read logs, they read incidents. We took 5 real log files from the
> provided project — 893 error entries, 5 MB — and turned them into 10 actionable incidents,
> ranked by severity, each with a root cause and a remediation step. Here it is on the web, and
> here it is on a phone."

Then show the number that makes the point:

> "893 entries became 10 incidents. One of them accounts for 661 of the 893 — that's 74% of your
> log volume being a single bug. That's the whole value proposition in one row."

---

## 2. Web demo — 4 minutes

Follow this order; it walks the web PDF top to bottom.

| # | Action | Requirement demonstrated |
|---|---|---|
| 1 | Show the dashboard already populated | Logs parsed and stored; analysis complete |
| 2 | Point at "Total incidents 10 / 893 grouped log entries" | Grouping similar entries into single incidents |
| 3 | Read the top row: title, summary, Critical badge | AI-generated title, summary, severity assignment |
| 4 | Point at the red left accent on the top rows | "Visually highlight Critical and High severity" |
| 5 | Point at occurrences 661, first seen, last seen | Occurrence count, first + latest occurrence timestamps |
| 6 | Walk the analytics row: total, by severity donut, by status bars, top types, trend line | Dashboard analytics: total, by severity, by status, most frequent types, trends over time |
| 7 | Type `access_token` in search | Search incidents by title or summary |
| 8 | Filter severity → Critical, then add status → New | Filter by severity; filter by status |
| 9 | Set the date range | Filter by date range (optional requirement) |
| 10 | Filter by module | Bonus: service/module impact analysis |
| 11 | Change Sort to Occurrences, then to Latest occurrence | Sort by severity / occurrences / latest occurrence |
| 12 | Click the 661 row to open the drawer | Selecting an incident shows its details |
| 13 | In the drawer, read: summary, AI explanation, root cause, remediation, confidence, similarity | AI explanation, likely root cause, suggested remediation, confidence score, similarity % |
| 14 | Scroll the drawer to the raw log entries | Related log entries |
| 15 | Change status to Investigating | Change incident status: New / Investigating / Resolved |
| 16 | Add an investigation note | Add investigation notes |
| 17 | Toggle dark mode | Bonus: dark mode |
| 18 | Drag a log file onto Upload, watch the progress bar | Upload one or more log files; view upload and processing status |
| 19 | Upload a `.txt` of junk, show the inline error | "Gracefully handle invalid or unsupported log files" |

**Line to say at step 6:** "None of the analytics cost an AI call. Because we group first, every
chart is arithmetic over 10 incidents instead of 893 model invocations."

**Line to say at step 19:** "It fails as a 400 with a specific error code, not a blank screen."

---

## 3. Mobile demo — 2 minutes

| # | Action | Requirement demonstrated |
|---|---|---|
| 1 | Cold-launch the app, sign in | Sign in with existing account; secure authenticated session |
| 2 | Kill the app and reopen — still signed in | Maintain an authenticated session (token in SecureStore) |
| 3 | Show the four summary tiles | Total active, Critical count, High count, currently Investigating |
| 4 | Show the list: title, summary, severity, status, occurrences, last seen | Mobile incident dashboard fields |
| 5 | Point at Critical/High highlighting | "Critical and High should be visually highlighted" |
| 6 | Pull to refresh | Bonus: pull-to-refresh |
| 7 | Search, then filter severity, then sort | Search by title/summary; filter severity + status; sort |
| 8 | Open an incident | Detail: summary, explanation, severity, status, root cause, remediation, related logs, occurrences, first + last seen |
| 9 | Change status | Change status / mark New, Investigating, Resolved |
| 10 | Tap Acknowledge | Acknowledge an incident |
| 11 | Tap Assign to me | Bonus: assign an incident to yourself |
| 12 | Add a note, then show the history list | Add investigation notes; view incident history and status changes |
| 13 | Trigger the notification, tap it | Notify on new Critical/High; open the incident from the notification (deep link) |
| 14 | Turn off wifi, reopen the list | "Gracefully handle network interruptions" + bonus offline viewing |

**The money moment — do this deliberately:** change a status on the phone, then pull-to-refresh
on the web (or vice versa). Same backend, two clients, one incident. It proves the three branches
are one system, not three demos.

---

## 4. Under the hood — 1 minute, only if asked

Show `src/infra/winston-parser.ts` and say:

> "The provided logs aren't JSON and aren't line-delimited — they're Winston `util.inspect` dumps.
> A block starts with `{` at column zero and ends with `}` at column zero, stack traces span
> multiple lines joined with string concatenation, and some entries nest an object inside the
> message field. We stream them with a block parser. We never `JSON.parse` or `eval` a log line —
> it's untrusted input."

Show `src/infra/fingerprint.ts`:

> "Then we normalise: UUIDs, IPs, numeric ids and nulls become placeholders, and we hash that.
> `locationId TUPSS23604` and `locationId null` are the same incident. That's how 893 collapses
> to 10 — and why analysis runs once per incident instead of 893 times."

Show `src/domain/ports.ts`:

> "Parser and analyzer are interfaces. The shipped analyzer is a deterministic rule engine, which
> is why this demo needs no API key and gives the same answer every time. An LLM implementation
> drops in behind the same interface without touching a caller."

Then run the test:

```bash
npm test
```

> "893 entries, 10 incidents, largest is 661. Those numbers are assertions, not aspirations — we
> derived them from the corpus before writing the parser, and the first implementation failed
> them."

---

## 5. Requirements coverage — the honest scorecard

### Core PDF

| Requirement | Status |
|---|---|
| Upload a provided log file | Done |
| Parse and store uploaded logs | Done |
| Support the provided log format | Done — custom Winston-inspect block parser |
| Analyze logs using AI | Rule-based analyzer behind an `Analyzer` interface — see Deferred |
| Group similar entries into one incident | Done — fingerprint grouping, 893 → 10 |
| Short summary per incident | Done |
| Severity Critical/High/Medium/Low | Done |
| Likely root cause | Done |
| Initial remediation step | Done |
| Confidence score (optional) | Done |
| Dashboard: title, summary, severity, status, occurrences, latest timestamp | Done |
| View details / change status / search / filter | Done |
| Details: related logs, explanation, remediation, count, first + last | Done |

### Web PDF

| Requirement | Status |
|---|---|
| Upload one or more files; view processing status | Done |
| Search by title or summary | Done |
| Filter by severity, status, date range | Done |
| Sort by severity, occurrences, latest occurrence | Done |
| Highlight Critical and High | Done |
| Incident management + notes | Done |
| Analytics: total, by severity, by status, most frequent, trends | Done |
| Responsive, modern desktop browsers | Done |
| Gracefully handle invalid log files | Done — 400 `UNSUPPORTED_LOG_FORMAT`, inline message |

### Mobile PDF

| Requirement | Status |
|---|---|
| Sign in, secure session | Done — JWT in SecureStore |
| Incident dashboard + summary counts | Done |
| Detail view with full AI fields | Done |
| Change status, acknowledge, assign, notes, history | Done |
| Search, filter, sort | Done |
| Notify on new Critical/High + open from notification | Done — local notifications + deep link |
| Handle network interruptions | Done — AsyncStorage cache |

### Bonus features delivered

Confidence score · similarity percentage · AI-generated titles · duplicate detection via
fingerprinting · severity distribution · trend over time · top recurring incidents ·
service/module impact · dark mode · colour-coded severity · advanced filtering · full-text
search · assign to self · investigation notes · activity history · background upload processing ·
analyzer response caching by fingerprint · pull-to-refresh · offline viewing · secure token
storage · deep linking.

### Deferred — say this plainly if asked, do not oversell

- **LLM-backed analysis.** `Analyzer` is an interface; the shipped implementation is a
  deterministic rule engine covering the corpus's failure patterns. Chosen for a reproducible,
  key-free demo. The seam is real — an LLM implementation is a new class, not a refactor.
- **Call-graph enrichment.** Stack frames could be resolved against a `graph.json` AST index of
  the source project to name the owning class and its callers in the root-cause text.
- CSV/PDF export, incident heatmap, expandable inline groups.
- Real FCM/APNs push (local notifications used instead), background sync workers.
- Generated OpenAPI docs; test coverage is focused on the parser rather than broad.

---

## 6. Questions to expect

**"Is this actually AI?"**
> The pipeline is AI-shaped and the analyzer is pluggable, but what ships is a deterministic rule
> engine. We made that call so the demo is reproducible and needs no API key. The interesting
> engineering is upstream anyway — grouping 893 entries into 10 is what makes an LLM affordable
> here, because you go from 893 calls to 10.

**"What happens with a much bigger file?"**
> The parser streams, so memory is flat. Grouping is a single pass with a hash map. The cost that
> would grow is analysis, and that scales with distinct incidents, not log lines.

**"Why is severity not just the log level?"**
> Every one of the 893 entries is `level: 'error'`. The level carries no information here, so
> severity has to be derived from what the error actually is.

**"Why three branches?"**
> One frozen API contract in `contract/`, committed before any app code. All three were built in
> parallel against it, with the clients running on a mock fixture generated from the real corpus
> so neither was blocked on the backend.
