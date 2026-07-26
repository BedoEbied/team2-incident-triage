# Mobile Bonus Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every named mobile bonus and AI feature with native behavior where available and reliable demo fallbacks everywhere else.

**Architecture:** Pure projection modules own priority, timeline, share text, and notification
diffing. Small storage and platform ports isolate pinning, sharing, notification delivery, and
background/resume refresh. Feature screens compose these units without moving business logic into
routes.

**Tech Stack:** Expo 57, React Native, Expo Router, React Native Paper, TanStack Query, SecureStore, AsyncStorage, expo-notifications

---

### Task 1: Priority, timeline, and share projections

**Files:**
- Create: `/Users/softxpert/triage-mobile/src/features/incidents/intelligence.ts`
- Create: `/Users/softxpert/triage-mobile/src/features/incidents/intelligence.test.ts`

- [ ] Test deterministic priority scores/ranks, investigation recommendation text, timeline order,
  and a concise share summary containing title, severity, status, root cause, and remediation.
- [ ] Implement pure functions with stable UTC timestamps and incident-id tie breaking.
- [ ] Run focused tests and commit as `feat: derive mobile incident intelligence`.

### Task 2: Pin storage and ordering

**Files:**
- Create: `/Users/softxpert/triage-mobile/src/storage/pins.ts`
- Create: `/Users/softxpert/triage-mobile/src/storage/pinsStore.ts`
- Create: `/Users/softxpert/triage-mobile/src/storage/pinsStore.test.ts`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/query.ts`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/query.test.ts`

- [ ] Test malformed storage recovery, toggle persistence, and pinned-first ordering after active
  filters.
- [ ] Implement one AsyncStorage key containing a validated string array; keep JWT storage wholly
  separate.
- [ ] Run tests/typecheck and commit as `feat: persist pinned incidents`.

### Task 3: Card quick actions

**Files:**
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/IncidentCard.tsx`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/DashboardScreen.tsx`

- [ ] Add source-contract tests for accessible Pin, Acknowledge, and Investigate actions.
- [ ] Render compact icon buttons without nested card navigation. Use mutations with query
  invalidation and Snackbar rollback messages.
- [ ] Show priority rank and a one-line recommendation while retaining dense rows.
- [ ] Run tests/typecheck and commit as `feat: add incident quick actions`.

### Task 4: AI timeline and sharing

**Files:**
- Create: `/Users/softxpert/triage-mobile/src/platform/share.ts`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/IncidentDetailScreen.tsx`

- [ ] Test native Share invocation and browser clipboard fallback through injected adapters.
- [ ] Add an AI timeline section and Share summary action. Display confirmation/failure in the
  existing Snackbar.
- [ ] Run tests/typecheck and commit as `feat: add AI timeline and incident sharing`.

### Task 5: Assigned-status notifications

**Files:**
- Modify: `/Users/softxpert/triage-mobile/src/notify/poll.ts`
- Create: `/Users/softxpert/triage-mobile/src/notify/diff.ts`
- Create: `/Users/softxpert/triage-mobile/src/notify/diff.test.ts`

- [ ] Test first-snapshot silence, new Critical/High alerts, assigned status-change alerts,
  deduplication, and incident deep-link payloads.
- [ ] Persist the previous lightweight snapshot, diff on each poll, and schedule local
  notifications through `NotificationPort`.
- [ ] Run tests/typecheck and commit as `feat: notify assigned incident changes`.

### Task 6: Background/resume synchronization

**Files:**
- Create: `/Users/softxpert/triage-mobile/src/sync/syncPort.ts`
- Create: `/Users/softxpert/triage-mobile/src/sync/resumeSync.ts`
- Create: `/Users/softxpert/triage-mobile/src/sync/resumeSync.test.ts`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/DashboardScreen.tsx`

- [ ] Fetch current Expo background task documentation with Context7 and confirm Expo Go support
  boundaries before selecting dependencies.
- [ ] Test app active/inactive transitions, single refresh per resume, cleanup, and cache update.
- [ ] Implement the supported native background adapter when available; always include the
  app-state resume adapter for Expo Go/web.
- [ ] Run tests/typecheck/Expo dependency check and commit as
  `feat: synchronize incidents on app resume`.

### Task 7: Demo notification and final UX

**Files:**
- Modify: `/Users/softxpert/triage-mobile/src/notify/poll.ts`
- Modify: `/Users/softxpert/triage-mobile/src/features/incidents/DashboardScreen.tsx`
- Modify: `/Users/softxpert/triage-mobile/README.md`
- Modify: `/Users/softxpert/triage-mobile/NOTES.md`

- [ ] Add a safe “Demo critical alert” dashboard action that schedules a local notification for
  the 661-occurrence incident and therefore exercises the real deep-link observer.
- [ ] Verify dark/light, offline cache, pin, quick actions, timeline, share, pull-to-refresh,
  notification tap, and web preview at a phone width.
- [ ] Run all explicit tests, typecheck, `expo install --check`, web export, Android export, and
  iOS export where the host supports it.
- [ ] Document platform-live versus adapter-tested evidence and commit as
  `docs: record full mobile competition coverage`.
