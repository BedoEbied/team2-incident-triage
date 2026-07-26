# Web Bonus Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every named web bonus feature and a polished guided demo without weakening existing behavior.

**Architecture:** Pure data modules calculate priority, heatmap, module impact, and exports. Focused components render the new command-center rail and expandable incident rows. TanStack Query owns bounded visible-page polling and mutation refresh.

**Tech Stack:** React, TypeScript, Mantine 8, TanStack Query, Recharts/Mantine Charts, Vite, jsPDF, Node test runner

---

### Task 1: Derived priority and analytics

**Files:**
- Create: `/Users/softxpert/triage-web/src/features/insights/priority.ts`
- Create: `/Users/softxpert/triage-web/src/features/insights/insights.ts`
- Create: `/Users/softxpert/triage-web/src/features/insights/insights.test.mjs`

- [ ] Write failing tests for deterministic severity/recency/frequency priority, 28 UTC-day
  heatmap buckets, and module occurrence aggregation.
- [ ] Run `node --test src/features/insights/insights.test.mjs`; expect missing-module failure.
- [ ] Implement pure functions with stable incident-id tie breaking and no mutation.
- [ ] Run the focused test; expect PASS.
- [ ] Commit as `feat: derive incident priority and impact insights`.

### Task 2: Command-center rail

**Files:**
- Create: `/Users/softxpert/triage-web/src/components/CommandCenter.tsx`
- Create: `/Users/softxpert/triage-web/src/components/FrequencyHeatmap.tsx`
- Create: `/Users/softxpert/triage-web/src/components/ModuleImpact.tsx`
- Modify: `/Users/softxpert/triage-web/src/pages/Dashboard.tsx`
- Modify: `/Users/softxpert/triage-web/src/styles.css`

- [ ] Add static source-contract tests for accessible labels, no gradients, responsive layout,
  and priority explanations.
- [ ] Render a three-column rail: top priority queue, module impact bars, and heatmap with a
  live/last-refresh status. Keep panels bordered, dense, and token-colored.
- [ ] Add a “Run judge demo” button that clears filters, sorts by occurrences, selects the
  661-occurrence incident, and scrolls the table into view.
- [ ] Run all web tests and production build.
- [ ] Commit as `feat: add judge-facing command center`.

### Task 3: Expandable incident groups

**Files:**
- Modify: `/Users/softxpert/triage-web/src/components/IncidentTable.tsx`
- Create: `/Users/softxpert/triage-web/src/components/IncidentPreviewRow.tsx`
- Create: `/Users/softxpert/triage-web/src/components/IncidentPreviewRow.test.mjs`

- [ ] Test keyboard/action isolation and loading/error/entry-preview source contracts.
- [ ] Add an explicit expansion button per row. Fetch detail only while expanded, render the
  first three entries in bounded monospace blocks, and keep row click opening the full drawer.
- [ ] Run tests/build and commit as `feat: expand grouped incident logs`.

### Task 4: Collaboration actions and activity text

**Files:**
- Modify: `/Users/softxpert/triage-web/src/api/client.ts`
- Modify: `/Users/softxpert/triage-web/src/components/DetailDrawer.tsx`
- Create: `/Users/softxpert/triage-web/src/components/activity.ts`
- Create: `/Users/softxpert/triage-web/src/components/activity.test.mjs`

- [ ] Test mock-mode acknowledgement/assignment persistence and formatting for status, note,
  assign, and acknowledgement activity types.
- [ ] Add Acknowledge and Assign to On-Call Engineer controls. Persist mock mutations in the same
  localStorage incident map used for status changes.
- [ ] Replace blank activity bodies with explicit descriptions derived from activity fields.
- [ ] Run tests/build and commit as `feat: complete web collaboration actions`.

### Task 5: CSV and PDF exports

**Files:**
- Modify: `/Users/softxpert/triage-web/package.json`
- Modify: `/Users/softxpert/triage-web/package-lock.json`
- Create: `/Users/softxpert/triage-web/src/features/export/csv.ts`
- Create: `/Users/softxpert/triage-web/src/features/export/pdf.ts`
- Create: `/Users/softxpert/triage-web/src/features/export/export.test.mjs`
- Create: `/Users/softxpert/triage-web/src/components/ExportMenu.tsx`

- [ ] Fetch current jsPDF documentation with Context7 and install it.
- [ ] Test RFC 4180 escaping, stable UTC fields, `%PDF-` output, and filenames.
- [ ] Implement pure CSV text and PDF byte generators, then browser download adapters.
- [ ] Add an export menu for the currently filtered incidents and include active-filter metadata.
- [ ] Run tests/build and commit as `feat: export incidents to CSV and PDF`.

### Task 6: Full-text search and live refresh

**Files:**
- Modify: `/Users/softxpert/triage-web/src/api/incidentQuery.ts`
- Modify: `/Users/softxpert/triage-web/src/api/incidentQuery.test.mjs`
- Modify: `/Users/softxpert/triage-web/src/pages/Dashboard.tsx`
- Modify: `/Users/softxpert/triage-web/src/components/UploadBar.tsx`

- [ ] Add a mock-mode test proving search matches entry message/stack through incident detail
  data and a polling-configuration test proving hidden tabs do not poll.
- [ ] Use a 5-second `refetchInterval`, `refetchIntervalInBackground: false`, and refresh incidents
  plus stats when an upload reaches done.
- [ ] Keep live mode search delegated to the backend query from the backend plan.
- [ ] Run tests/build and commit as `feat: add live dashboard refresh`.

### Task 7: Regression and visual verification

**Files:**
- Modify: `/Users/softxpert/triage-web/src/theme/brand.test.mjs`
- Modify: `/Users/softxpert/triage-web/README.md`
- Modify: `/Users/softxpert/triage-web/NOTES.md`

- [ ] Update the brittle severity-accent test to accept the equivalent longhand border form while
  still requiring 3px, solid, and token color.
- [ ] Run all tests in Africa/Cairo and America/Los_Angeles, then typecheck/build.
- [ ] Render light/dark desktop and 390px mobile widths; inspect expansion, drawer, export, upload
  success/error, and guided demo.
- [ ] Document every bonus and the 90-second demo route; commit as
  `docs: record full web competition coverage`.
