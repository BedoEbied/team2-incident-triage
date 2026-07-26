# HARDENING PASS — Web Dashboard (branch `frontend`)

The dashboard is built, committed, `tsc --noEmit` is clean and `npm run build` passes. This is a
correctness and polish pass, not a rewrite. **Do not restructure working code.** Fix the defects
below, then do the general sweep. Commit in small, separate commits.

`contract/` remains frozen — do not edit it.

---

## Defects found in live QA — fix these first

### 1. Timestamps render in local time and shift the date (highest priority)

Verified in a browser with `TZ=Africa/Cairo`:

- Source log line: `timestamp: '2026-05-16 23:51:08'` (in `2026-05-16.log`)
- Stored by the API as: `2026-05-16T23:51:07Z`
- Rendered in the incident table as: **`May 17, 02:51 AM`** — a day later
- Meanwhile the Trend chart on the *same screen* plots that incident under **`2026-05-16`**,
  because the backend buckets trend by UTC date

So one incident shows two different dates on one page, and "first seen"/"last seen" can be
wrong by a day for any entry late in a UTC day.

**Fix:** render every timestamp in **UTC**. The source logs carry no timezone at all, so UTC is
the only defensible interpretation — inventing a local offset invents data. Pass
`timeZone: 'UTC'` to every `Intl.DateTimeFormat` / `toLocaleString` call, centralise the
formatting in one helper, and label the column or values so it is unambiguous (e.g. a
`UTC` suffix or a column header of `First seen (UTC)`).

Check every surface: table columns, detail drawer, chart axis labels, and the date-range filter
(the filter sends `YYYY-MM-DD` and must compare against UTC dates, not local ones, or filtering
near midnight silently drops rows).

### 2. Two incidents share the title "Connection timeouts reaching the Sterling API"

They are genuinely different failures — one is `connect ETIMEDOUT <ip>`, the other is
`read ETIMEDOUT` — but the shared title makes them look like a duplicate-grouping bug to anyone
reading the dashboard. The backend is being changed to distinguish them. On this side, make sure
nothing in the UI assumes titles are unique (React `key` must use `incident.id`, never the title
or the array index).

### 3. The dark-mode toggle is a button labelled `D` / `L`

Cryptic. Use a sun/moon icon or at minimum add `aria-label="Toggle color scheme"` and a tooltip.
Do not add an icon library for this — an inline SVG is fine.

---

## General sweep

**Correctness**
- Every list render keys off a stable id, never an array index.
- Loading, empty and error states exist for the incident list, the analytics row and the drawer.
  "No incidents match these filters" must be distinguishable from "still loading" and from
  "the request failed".
- Filters compose correctly: search + severity + status + module + date range applied together
  narrow the set rather than fighting each other. Clearing one filter restores rows.
- The visible count text agrees with the number of rows actually rendered.

**Contract conformance**
- Re-read `contract/api.md`. Confirm the client sends `severity` and `status` as comma-separated
  values, and `sort`/`order` with the exact documented spellings.
- Confirm the client handles every documented error code, not just `UNSUPPORTED_LOG_FORMAT`.
  A 401 should surface as a clear message rather than an empty dashboard.

**Robustness**
- Log text is untrusted input rendered into the DOM. Confirm nothing renders it via
  `dangerouslySetInnerHTML`. Stack traces must be displayed as text.
- Long stack traces and long messages must not break the layout — they belong in a container
  that scrolls on its own axis, and the page body must never scroll horizontally.
- The upload flow must clean up its polling interval on unmount and when a job reaches a terminal
  state, or it leaks timers.

**UI rules** (from `contract/tokens.ts`, still binding)
- No gradients, no purple, no glassmorphism, no stacked shadows, borders over shadows,
  radius 4px, dense rows, and monospace for log lines, stack traces, codes and timestamps.
- Verify the Critical/High left accent border is actually visible in both light and dark.

**Hygiene**
- Delete any remaining Vite template files, unused imports, dead code and commented-out blocks.
- No `any` crossing a module boundary. No `console.log` left behind.
- `fetch` appears only in `src/api/client.ts`.

---

## Verification before you finish

1. `npx tsc --noEmit` exits 0
2. `npm run build` exits 0
3. `TZ=Africa/Cairo npm run dev`, then confirm the `Location.Provider` incident shows
   **`May 16`** in the table, matching the trend chart. Also spot-check with `TZ=America/Los_Angeles`
   — the rendered dates must be identical under both.
4. Toggle dark mode and confirm no purple, no gradient, and a visible Critical accent.
5. Apply each filter individually and in combination; the count and the rows agree every time.

Report what you changed and anything you deliberately left alone.

---

## Standing instructions

Work only inside your current working directory. **Do not modify `contract/`.** Commit as you go
with small messages. If blocked, write your best working approximation and record the blocker in
`NOTES.md` rather than stopping. Do not run `git push`, `git merge`, `git rebase`, or touch other
branches.
