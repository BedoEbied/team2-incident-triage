# Team 2 — AI-Powered Incident & Log Triage

Upload application logs, have them grouped and triaged automatically, and work the resulting
incidents from a web dashboard or a phone.

Three deliverables, one per branch:

| branch | deliverable | runs on |
|---|---|---|
| `backend` | Express + SQLite API — parsing, grouping, analysis, auth | `:4000` |
| `frontend` | Vite + React + Mantine dashboard | `:3000` |
| `mobile` | Expo + React Native Paper app | Expo Go |

`main` holds only the frozen contract, the log fixtures and the agent briefs. Branches are left
unmerged so each deliverable can be reviewed on its own.

## Demo

Three worktrees, three terminals, all running at once:

```bash
git worktree add ../triage-backend backend && cd ../triage-backend && npm i && npm run dev
```

```bash
git worktree add ../triage-web frontend && cd ../triage-web && npm i && npm run dev
```

```bash
git worktree add ../triage-mobile mobile && cd ../triage-mobile && npm i && npx expo start
```

Sign in with **`oncall@demo.io` / `demo1234`**.

Walkthrough: backend seeds 893 log entries into 10 incidents on boot → the web dashboard shows
the 661-occurrence `access_token` Critical at the top → filter to Critical → set it to
Investigating → pull-to-refresh on the phone shows the same status → a local notification fires
for a new Critical and deep links into its detail.

## How it works

The log files are Winston `util.inspect` dumps — not JSON, not line-delimited. A streaming block
parser reads entries delimited by `{` and `}` at column 0, rejoins multi-line stack traces, and
descends into nested-object messages.

Entries are then **fingerprinted and grouped before any analysis**: the message is normalized
(UUIDs, IPs, numeric ids and `null` replaced with placeholders) and hashed, which collapses
893 raw entries into 10 incidents. Analysis therefore runs once per incident rather than once
per entry, which is what keeps ingestion of a 5 MB corpus fast.

Severity cannot be read from the logs — every entry is `level: 'error'` — so it is derived by
the analyzer from the normalized message, along with a title, summary, likely root cause,
remediation and a confidence score.

## AI analysis

Incident analysis uses a Chain of Responsibility over three providers:

1. **OpenAI** — when `OPENAI_API_KEY` is set (optional `OPENAI_MODEL`, default `gpt-5.6`)
2. **`claude` CLI** — when the `claude` binary is on `PATH` (subscription-authed, no API key)
3. **Rule engine** — always last; the chain never fails open

Analysis runs **once per incident** (10 calls for the seeded corpus, not 893). Log text is treated
as untrusted data inside a delimited `<LOG_DATA>` block. Without a key and without `claude`, boot
behaves exactly as the deterministic rule engine.

## Contract

`contract/` is frozen and shared by all three branches: `types.ts` (domain types), `api.md`
(endpoints), `tokens.ts` (design tokens), and `mock.json` (a fixture generated from the real
corpus so the clients can be built and demoed independently of the backend).

## Deferred — known scope, not oversights

These were consciously left out to fit the build window, and the seams for them are in place:

- **LLM-backed analysis.** `Analyzer` is an interface; the shipped implementation is a
  deterministic rule engine. That makes the demo reproducible and key-free, and an LLM
  implementation drops in behind the same interface.
- **Call-graph enrichment.** Stack frames could be resolved against a `graph.json` AST index of
  the source project to name the owning class and its callers in the root-cause text.
- CSV/PDF export, incident heatmap, expandable groups.
- Real FCM/APNs push (local notifications are used instead), background sync workers.
- Generated OpenAPI docs and a full automated test suite.
