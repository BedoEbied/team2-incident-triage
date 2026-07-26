# Mobile Hardening and Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Luciq-adapted brand and harden timestamp, filtering, refresh, poller, storage,
deep-link, error-state, and untrusted-log behavior without restructuring the existing app.

**Architecture:** Preserve Expo Router feature screens and TanStack Query. Add focused pure helpers
for native font selection, UTC formatting, incident-query composition, poll scheduling, and secure
token storage so the behavioral changes are testable and shared by every caller.

**Tech Stack:** Expo SDK 57, React 19, React Native 0.86, Expo Router, React Native Paper 5,
TanStack Query 5, expo-font, Expo Google Fonts, SecureStore, AsyncStorage, TypeScript, Node test
runner through `tsx`.

---

### Task 1: Copy tokens and rebuild the brand theme

**Files:**
- Replace: `src/theme/tokens.ts`
- Create: `src/theme/types.ts`
- Create: `src/theme/fonts.ts`
- Modify: `src/theme/paperTheme.ts`
- Modify: `app/_layout.tsx`
- Modify: `src/features/auth/LoginScreen.tsx`
- Modify: `src/features/incidents/DashboardScreen.tsx`
- Modify: `src/features/incidents/IncidentCard.tsx`
- Modify: `src/features/incidents/IncidentDetailScreen.tsx`
- Modify: `src/features/incidents/chips.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the bundled font packages**

Run:

```bash
npm_config_cache=/private/tmp/triage-mobile-npm-cache npx expo install expo-font @expo-google-fonts/instrument-sans @expo-google-fonts/instrument-serif
```

Expected: dependencies are added without an Expo compatibility warning.

- [ ] **Step 2: Copy the contract tokens verbatim and add its local type adapter**

Copy `contract/tokens.ts` byte-for-byte to `src/theme/tokens.ts`. Add `src/theme/types.ts` that
re-exports `Severity` and `Status` from `@/api/types`, then verify:

```bash
cmp contract/tokens.ts src/theme/tokens.ts
```

Expected: exit 0 and no output.

- [ ] **Step 3: Add the native font adapter**

The adapter must expose loaded names and system fallbacks derived from the three token roles:

```ts
export type AppFonts = {
  display: string;
  ui: string;
  uiSemibold: string;
  mono: string;
};

export function appFonts(loaded: boolean): AppFonts;
```

Use only Instrument Serif 400, Instrument Sans 400/600, and platform fallbacks.

- [ ] **Step 4: Replace the Paper defaults with a complete brand theme**

Construct an `MD3Theme` without importing Paper's default light, dark, or generic theme objects.
Assign every MD3 color role and configure every Paper typescale variant with the native UI family.

- [ ] **Step 5: Load fonts without blocking fallback rendering**

Call `useFonts` in `app/_layout.tsx`, pass only its `loaded` boolean into `paperTheme`, and continue
rendering with fallback families when not loaded or when the hook reports an error.

- [ ] **Step 6: Apply the display/UI/mono roles**

Set screen/display headings to the regular serif face. Set all four summary values to
`DENSITY.statSize` (40) and `fontWeight: '400'`. Set log, timestamp, stack, code, and machine-count
styles to the mono family. Apply radius 8 to controls/cards and 16 to large panels. Add only a
small lime brand mark in the Appbar; keep semantic colors sourced from severity/status tokens.

- [ ] **Step 7: Verify and commit the rebrand**

Run:

```bash
npx tsc --noEmit
cmp contract/tokens.ts src/theme/tokens.ts
rg -n -e '#62''00EE' -e '#BB''86FC' -e 'MD3''LightTheme' -e 'MD3''DarkTheme' -e 'Default''Theme' src app
```

Expected: TypeScript and `cmp` exit 0; ripgrep finds nothing.

Commit the rebrand files only with:

```bash
git commit --only -m "Rebrand mobile app with warm incident theme" <rebrand paths>
```

### Task 2: Centralize UTC timestamps

**Files:**
- Create: `src/features/incidents/format.test.ts`
- Modify: `src/features/incidents/format.ts`
- Modify: `src/features/incidents/IncidentCard.tsx`
- Modify: `src/features/incidents/IncidentDetailScreen.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the test runner**

Install `tsx` and `@types/node`, then add `"test": "tsx --test src/**/*.test.ts"`:

```bash
npm_config_cache=/private/tmp/triage-mobile-npm-cache npm install --save-dev tsx @types/node
```

- [ ] **Step 2: Write and run the failing UTC test**

The test calls the desired `formatUtcDateTime` with `2026-05-16T23:51:08Z`, changes
`process.env.TZ` between `UTC` and `Africa/Cairo`, and expects identical strings containing
`May 16`, `11:51 PM`, and `UTC`.

Run:

```bash
npm test -- src/features/incidents/format.test.ts
```

Expected: FAIL because `formatUtcDateTime` is not exported.

- [ ] **Step 3: Implement the single UTC formatter**

Use one `Intl.DateTimeFormat('en-US', { ..., timeZone: 'UTC' })` with a `seconds` option and append
`UTC`. Remove the local-time formatter functions.

- [ ] **Step 4: Route every visible timestamp through it**

Update list last-seen text, detail First/Last seen fields, log-entry timestamps, and history
timestamps. Include `(UTC)` in First/Last labels and include a `UTC` label in every formatted
value.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/features/incidents/format.test.ts
npx tsc --noEmit
rg -n 'DateTimeFormat|toLocale(Date|String)|formatDateTime|formatFullDateTime' src app
```

Expected: the test and typecheck pass; only the central formatter owns `DateTimeFormat`.

Commit:

```bash
git commit --only -m "Render incident timestamps consistently in UTC" <timestamp paths>
```

### Task 3: Compose filters and preserve cached rows on errors

**Files:**
- Create: `src/features/incidents/query.test.ts`
- Create: `src/features/incidents/query.ts`
- Modify: `src/api/client.ts`
- Modify: `src/features/incidents/DashboardScreen.tsx`
- Modify: `src/storage/cache.ts`

- [ ] **Step 1: Write and run failing composition tests**

Build three incidents where two have similar titles. Assert that search, severity, status, and
last-seen sort all apply together; then remove one filter at a time and assert the expected IDs
return in order.

Run:

```bash
npm test -- src/features/incidents/query.test.ts
```

Expected: FAIL because `applyIncidentQuery` does not exist.

- [ ] **Step 2: Implement the pure query helper**

Export:

```ts
export function applyIncidentQuery(items: Incident[], query?: IncidentQuery): Incident[];
```

Filter in sequence without mutating the input and sort a copied array with severity rank,
occurrences, or parsed last-seen time.

- [ ] **Step 3: Reuse it in the mock client and cached fallback**

Remove duplicate private mock filter/sort logic. Only replace the full incident cache on an
unfiltered request. On request failure, read cached rows, pass them through the same helper, keep
the rows, and expose a warning message.

- [ ] **Step 4: Make dashboard states mutually exclusive**

Render explicit initial loading, initial failure, successful empty-filter, cached warning, and
loaded-list states. Keep `RefreshControl` bound to `isRefetching`/manual `refetch`.

- [ ] **Step 5: Verify stable keys, tests, and commit**

Run:

```bash
npm test -- src/features/incidents/query.test.ts
npx tsc --noEmit
rg -n 'key=' src app
```

Expected: all tests pass and list keys are stable IDs.

Commit:

```bash
git commit --only -m "Harden incident filters and cached error states" <query paths>
```

### Task 4: Harden API and detail failure behavior

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/features/incidents/IncidentDetailScreen.tsx`

- [ ] **Step 1: Add a typed API error parser test**

Add focused cases to the closest pure API helper test for a contract error body, a non-JSON body,
and status 401. Expected messages must be stable and no parsed value may be `any`.

- [ ] **Step 2: Parse response payloads as unknown**

Introduce a typed `ApiClientError` carrying `status` and optional contract code. Catch JSON parse
failure, derive a safe message through type guards, and never dereference an unvalidated body.

- [ ] **Step 3: Distinguish detail states and mutation failures**

Show loading only while the initial request is pending. Show a retryable request error when no
detail exists. Keep previously loaded detail visible with a warning when refetch fails. Route patch
and note mutation failures into the existing Snackbar.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test
npx tsc --noEmit
```

Expected: all tests and TypeScript pass.

Commit:

```bash
git commit --only -m "Handle incident request failures without losing data" <API/detail paths>
```

### Task 5: Stop pollers and prove secure token deletion

**Files:**
- Create: `src/notify/pollController.test.ts`
- Create: `src/notify/pollController.ts`
- Modify: `src/notify/poll.ts`
- Modify: `src/features/incidents/DashboardScreen.tsx`
- Create: `src/storage/tokenStore.test.ts`
- Create: `src/storage/tokenStore.ts`
- Modify: `src/storage/token.ts`

- [ ] **Step 1: Write failing poll lifecycle tests**

Use injected `setInterval`/`clearInterval` fakes. Assert no token creates no interval, cleanup clears
exactly once, and starting a replacement stops the previous interval.

Run:

```bash
npm test -- src/notify/pollController.test.ts
```

Expected: FAIL because the pure poll controller does not exist.

- [ ] **Step 2: Implement and integrate the poll controller**

Keep Expo notification scheduling in `poll.ts`. Use the controller for interval ownership, make
cleanup idempotent, and skip polling when the token is null. Keep the dashboard effect returning
the cleanup function.

- [ ] **Step 3: Write the failing token adapter test**

Inject a fake secure key-value port, call `setToken`, `getToken`, and `clearToken`, and assert the
same JWT key is passed to set/get/delete. The delete assertion proves the operation used by logout.

- [ ] **Step 4: Implement and integrate the token adapter**

Keep SecureStore import in `token.ts`; move only the pure adapter and key into `tokenStore.ts`.
AsyncStorage remains confined to `storage/cache.ts`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/notify/pollController.test.ts src/storage/tokenStore.test.ts
npx tsc --noEmit
rg -n 'AsyncStorage|SecureStore|setInterval|clearInterval' src
```

Expected: lifecycle/storage tests pass; AsyncStorage appears only in incident cache code and the
JWT adapter uses SecureStore.

Commit:

```bash
git commit --only -m "Stop notification polling when sessions end" <poll paths>
git commit --only -m "Keep JWT lifecycle in SecureStore" <token paths>
```

### Task 6: Harden cold links, long logs, and hygiene

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(app)/incident/[id].tsx`
- Modify: `src/notify/poll.ts`
- Modify: `src/features/incidents/IncidentDetailScreen.tsx`
- Modify: any file with a confirmed unused import, dead block, template artifact, or console output

- [ ] **Step 1: Normalize the deep-link parameter**

Keep the route thin. Convert `string | string[] | undefined` to one string and let the detail
screen render its missing-ID error without fetching.

- [ ] **Step 2: Harden the notification observer**

Handle both the last notification response and live response listener, ignore non-string URLs,
cancel pending async redirection after unmount, and remove the listener.

- [ ] **Step 3: Constrain untrusted machine text**

Use selectable `Text` only. Put each long log message/stack trace in a horizontal ScrollView with
monospace styling and no markup parser or HTML/WebView dependency.

- [ ] **Step 4: Remove confirmed hygiene issues**

Delete only files proven to be leftover templates, remove unused imports and dead/commented code,
and remove stray console output. Do not change `contract/`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test
npx tsc --noEmit
rg -n 'console\\.log|\\bany\\b|TO''DO|FIX''ME' src app
```

Expected: tests/typecheck pass and no hygiene match remains except a justified local generic type
inside dependencies (dependencies are excluded).

Commit:

```bash
git commit --only -m "Harden deep links and untrusted log rendering" <deep-link/log paths>
git commit --only -m "Remove mobile app hygiene leftovers" <hygiene paths>
```

### Task 7: Run full verification

**Files:**
- Create only if required by an impossible check: `NOTES.md`

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
npx tsc --noEmit
npx expo install --check
```

Expected: all exit 0.

- [ ] **Step 2: Build and smoke-start Expo**

Run a deterministic export bundle, then start Expo long enough to receive a successful manifest or
bundle response. Stop the process afterward.

Expected: Metro reports no bundling error and the export/start command exits or is terminated only
after successful output.

- [ ] **Step 3: Run source invariants**

```bash
cmp contract/tokens.ts src/theme/tokens.ts
rg -n -e '#62''00EE' -e '#BB''86FC' -e 'MD3''LightTheme' -e 'MD3''DarkTheme' -e 'Default''Theme' . -g '!node_modules/**' -g '!.git/**'
rg -n 'tileValue|statSize|fontWeight' src/features/incidents/DashboardScreen.tsx
rg -n 'timeZone: .UTC.|formatUtcDateTime' src
rg -n 'key=' src app
rg -n 'AsyncStorage|SecureStore' src
```

Expected: token files match; banned-theme grep is empty; the other greps demonstrate 40px/400
display stats, centralized UTC formatting, stable IDs, and separated cache/token stores.

- [ ] **Step 4: Inspect final repository state**

```bash
git status --short
git log --oneline --decorate -12
git diff --check
```

Expected: only the pre-existing staged `contract/tokens.ts` user change remains outside the task
commits, commits are small and ordered, and no whitespace errors exist.

- [ ] **Step 5: Record only genuine limitations**

If a required runtime-only check cannot be automated in the available Expo environment, add a
specific `NOTES.md` entry naming the closest implemented verification and why the physical-device
observation is unavailable. Do not add `NOTES.md` for checks that succeeded.
