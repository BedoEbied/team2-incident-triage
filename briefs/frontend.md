# BRIEF — Web Dashboard (branch `frontend`)

You are building the web dashboard for **Team 2**'s competition entry: an AI-powered incident
and log triage dashboard for on-call engineers. You have roughly **25 minutes**. Work only in
your current directory.

Read `contract/api.md`, `contract/types.ts`, `contract/tokens.ts` and `contract/mock.json` first.
They are frozen.

## Stack

Vite + React + TypeScript (`strict: true`) + **Mantine v8** + `@mantine/charts` + TanStack Query.
Port **3000**.

Mantine v8 essentials (verified current):

```ts
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import { createTheme, MantineProvider, useMantineColorScheme } from '@mantine/core';
import { DonutChart, BarChart, LineChart } from '@mantine/charts';
```

`@mantine/charts` needs `recharts` as a peer dependency. `MantineProvider` takes
`defaultColorScheme` and a `createTheme(...)` object; `useMantineColorScheme()` drives the
light/dark toggle.

## Build against the mock from minute zero

`contract/mock.json` is generated from the **real** 893-entry log corpus — 10 incidents whose
occurrences sum to 893, including a 661-occurrence Critical. **Do not wait for the backend.**

`src/api/client.ts` is the only module in the app that knows about HTTP or about the mock.
Export a single `API_BASE` / `USE_MOCK` switch at the top; integration is flipping that one
constant. No `fetch` anywhere else in the codebase.

## Layout

```
src/api/client.ts      the ONLY module that talks HTTP or reads the mock
src/api/types.ts       copied verbatim from contract/types.ts
src/theme/tokens.ts    copied verbatim from contract/tokens.ts
src/theme/theme.ts     createTheme() built from tokens
src/pages/Dashboard.tsx
src/components/SeverityBadge.tsx StatusPill.tsx IncidentTable.tsx
                DetailDrawer.tsx UploadBar.tsx AnalyticsRow.tsx Filters.tsx
```

Components render, hooks fetch. All server state goes through TanStack Query.

## Screens — single page plus a drawer

**Header** — product title, dark-mode toggle, and `UploadBar`: multi-file drag-drop posting to
`POST /uploads` (repeatable `files` field), then polling `GET /uploads/:jobId` and rendering a
`Progress` bar. On HTTP 400 `UNSUPPORTED_LOG_FORMAT`, show `error.message` inline — never a
crash, never a blank state. This graceful-failure path is an explicit requirement.

**AnalyticsRow** (required, not a bonus) — total incidents, incidents by severity (`DonutChart`),
by status (`BarChart`), most frequent incident types from `stats.topIncidents` (horizontal
`BarChart`), and `stats.trend` over time (`LineChart`). Use `CHART_SERIES` from tokens for
series colours — no default rainbow palettes.

**Filters** — search over title+summary (`TextInput`), severity `MultiSelect`, status
`MultiSelect`, module `Select`, date range (`DatePickerInput`), and sort by
severity / occurrences / lastSeen.

**IncidentTable** — columns: title, summary, severity badge, status pill, occurrences,
first seen, last seen. **Critical and High rows carry a 3px left accent border in the severity
colour plus the `accentRow` tint.** Row height 38px. Clicking a row opens the drawer.

**DetailDrawer** — AI summary, explanation, root cause, remediation, confidence, similarity,
occurrence count, first/last seen, affected modules, a status `Select` that issues
`PATCH /incidents/:id`, a notes composer posting to `/incidents/:id/notes`, and the related raw
log entries in a scrollable monospace block.

## UI rules — binding, see `contract/tokens.ts`

Reference points: Sentry, Datadog, Linear. Dense, neutral, quiet.

**Banned:** gradients of any kind (especially purple→pink), glassmorphism or blur panels,
stacked drop shadows, neon or pastel colours, colour-tinted page backgrounds, emoji as icons,
"AI sparkle" motifs, pill radius on everything, more than one accent hue beyond the semantic
severity/status colours, airy marketing spacing.

**Required:** borders over shadows (1px, `CANVAS.*.border`), radius 4px, 38px rows, 13px body
text, and **monospace (`FONT_MONO`) for log lines, stack traces, error codes and timestamps**.

Colour appears in exactly four places: severity badge, the Critical/High row accent, chart
series, and the status pill. Buttons, headers, cards and nav stay neutral.

Delete every leftover file and style from the Vite template. Judges notice scaffolding.

## Minute budget

| min | deliverable |
|---|---|
| 0–6 | scaffold, theme from tokens, api client with mock/live switch |
| 6–14 | table + filters/search/sort + Critical/High accent |
| 14–20 | detail drawer + status change + notes |
| 20–24 | analytics row |
| 24–25 | upload bar + job polling + inline error |

If you fall behind, cut in this order: CSV export, module filter, date-range filter. Protect the
table, the drawer and the analytics row.

## Acceptance

1. `npm run dev` renders a populated dashboard with the backend **down** (mock mode)
2. Every filter and the search box change the visible row count
3. The 661-occurrence Critical incident is visible and visually highlighted
4. Dark mode toggles cleanly; no purple, no gradient anywhere
5. Status change round-trips and persists after reload once live
6. `npx tsc --noEmit` is clean

---

## Standing instructions

Work only inside your current working directory. **Do not modify `contract/`** — it is frozen;
if the API disagrees with it, fix your own code. Commit to the current branch as you go with
small messages. If blocked, write your best working approximation and record the blocker in
`NOTES.md` rather than stopping. Do not run `git push`, `git merge`, `git rebase`, or touch
other branches.
