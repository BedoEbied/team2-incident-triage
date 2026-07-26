# Competition-Ready Full-Coverage Design

## Objective

Turn the three existing deliverables into a reliable competition demo that visibly satisfies the
core, optional, bonus, and AI requirements in the supplied core, web, and mobile briefs. The
system must remain useful without credentials, network access, another human, a push service, or
a native device, while using real integrations when they are available.

The frozen files under `contract/` remain unchanged. Backend, frontend, and mobile remain separate
branches and applications.

## Chosen approach

Use full feature coverage with graceful degradation:

- real OpenAI analysis when `OPENAI_API_KEY` is configured;
- local Claude CLI analysis when the binary is available;
- the deterministic rule analyzer as a guaranteed final fallback;
- browser/native adapters for share, pin, background refresh, notifications, and export;
- deterministic demo paths wherever an external actor or unavailable platform service would
  otherwise interrupt the presentation.

This preserves real engineering depth while ensuring the judges always see populated, interactive
screens.

## Backend architecture

### Asynchronous analyzer chain

Move the existing rule analyzer unchanged into `src/infra/analyzers/` and add:

- `openai-analyzer.ts`: official OpenAI SDK, strict structured output, configurable current model;
- `claude-cli-analyzer.ts`: `execFile` or `spawn` with an argument array, prompt on stdin;
- `rule-analyzer.ts`: the existing deterministic rules;
- `chain-analyzer.ts`: provider ordering, fallthrough, cache lookup, and a four-slot semaphore;
- `analysis-schema.ts`: output validation, string limits, control-character stripping, severity
  validation, and confidence clamping;
- `prompt.ts`: delimited untrusted-data prompt construction and field truncation;
- `analysis-cache.ts`: persistent fingerprint/provider-version cache with atomic file replacement.

`Analyzer.analyze` becomes asynchronous. Repository ingestion groups first, requests at most four
analyses concurrently, and only then commits the already-validated results. No provider is ever
called per log entry. Parser, fingerprinting rules, grouping keys, and the 893 / 10 / 661 golden
numbers do not change.

Each remote provider gets a 15-second timeout and one bounded retry. An unavailable or invalid
provider result is a typed failure local to the chain; the chain itself always returns an analysis.
The boot line reports the preferred available provider and its fallbacks.

### Security

Log content is included only in a user-message data block explicitly marked as untrusted data, is
never included in a system instruction, and is truncated before transport. Model output is parsed
as unknown and validated before caching or persistence. Claude receives the prompt through stdin,
never through a shell string or an argument. Cached data uses a fixed application-owned path and
fingerprint keys only.

### API and ingestion

Existing routes and frozen response shapes remain stable. Uploads continue to stage atomically,
report progress, reject unsupported files clearly, and preserve live data on failure. List search
is extended to related log messages so “full-text across incidents and logs” is real. Existing
status, acknowledgement, assignment, notes, history, filtering, statistics, and auth behavior
remain intact.

## Web dashboard

### Judge-facing command center

Keep the warm editorial operations theme, dense incident table, visible Critical/High accents,
UTC presentation, dark mode, keyboard support, and responsive layout. Add a compact “coverage
rail” above the incident table:

- priority queue with a transparent severity/recency/frequency score;
- service/module impact chart;
- incident-frequency heatmap;
- live-update indicator and last refresh time;
- export menu for CSV and a generated PDF;
- a one-click guided demo control that resets filters and focuses the 661-occurrence incident.

The existing charts continue to show total, severity, status, top recurring incidents, and trend.
New derived analytics use already-loaded incident/stat data and do not add AI calls.

### Expandable groups and collaboration

Each incident row gets an explicit expander. Expanding fetches the existing incident detail and
shows a compact raw-log preview without preventing the full drawer from opening. The drawer adds
acknowledge and assign-to-demo-engineer actions, retains status and notes, and renders every
activity type with meaningful text.

### Real-time and demo safety

TanStack Query performs bounded polling while the page is visible and refreshes immediately after
uploads or mutations. Mock mode persists mutations locally so status, notes, assignments, and
acknowledgement still demonstrate without the backend. Exports operate entirely client-side.
Unsupported uploads remain an inline recoverable error.

## Mobile application

### AI and productivity additions

Add a priority rank and investigation recommendation to incident cards and detail. The detail
screen derives an “AI incident timeline” from first seen, last seen, status/history events, and
the current analysis. These are deterministic projections of analyzed incident data, so they are
available offline.

Incident cards expose restrained quick actions for acknowledge, Investigating, and pin. Pins are
stored separately from the JWT in AsyncStorage, sort ahead of otherwise-equal incidents, and work
offline. Detail adds native share with a browser clipboard fallback. Existing assign-to-self,
notes, activity history, confidence, similarity, remediation, and related logs remain.

### Notifications and background behavior

The notification poller continues to detect new Critical/High incidents and deep-link into detail.
It also tracks assigned-incident status changes and emits a local notification. A background-sync
port uses the supported Expo task APIs when available; Expo Go and web use an app-state/resume
adapter that refreshes and updates the offline cache without claiming unavailable OS execution.
A visible demo notification action safely creates the competition-room notification moment.

### Demo-safe platform adapters

SecureStore remains mandatory on iOS/Android; the already-added browser adapter is explicitly for
web preview only. Share, notifications, background task registration, and clipboard each degrade
to a local confirmation rather than an exception. The app remains usable with the backend down.

## Coverage map

### Core brief

- ingestion, parsing, storage, large-file streaming, grouping, summary, severity, root cause,
  remediation, dashboard, detail, status, search, filters, timestamps, and highlighting: preserve;
- confidence, similarity, AI titles, duplicate detection, priority order, analytics, live
  progress, expandable groups, dark/responsive UI, module/date/full-text filters, assignment,
  notes, history, background analysis, cache, retry, API docs, and core tests: explicitly verify;
- real AI: add provider chain without changing grouping invariants.

### Web brief

- heatmap, module impact, CSV/PDF export, expandable groups, priority view, live updates,
  assignment, acknowledgement, and full-text log search: add;
- all existing upload, analytics, filtering, sorting, detail, collaboration, invalid-file,
  responsive, and dark-mode paths: preserve and regression-test.

### Mobile brief

- AI recommendation, AI timeline, priority order, quick actions, pin, share, assigned-status
  notifications, and background sync adapter: add;
- secure session, dashboard summaries, detail, status, acknowledgement, assignment, notes, history,
  search/filter/sort, pull-to-refresh, offline cache, dark mode, local Critical/High notifications,
  and deep links: preserve and regression-test.

## Error handling

Remote AI failures never empty the dashboard. Invalid AI output is discarded rather than partly
persisted. Polling pauses when appropriate and never replaces good cached rows with an error.
Exports and native actions produce explicit success/failure feedback. Mutations roll back
optimistic UI when the request fails. Long/untrusted log text remains plain selectable monospace
content in bounded scroll containers.

## Testing and verification

Implementation is test-first. Required evidence includes:

- backend provider fallthrough, timeout/retry, prompt-injection containment, schema validation,
  cache hit, concurrency bound, full-text log search, all existing tests, typecheck, boot
  invariants, rule-only boot, provider boot where available, and smoke script;
- web unit tests for priority, heatmap/module analytics, export escaping/PDF generation,
  expandable loading, mock collaboration, and live-refresh configuration; all existing tests,
  typecheck, production build, and visual inspection in light/dark at desktop and mobile widths;
- mobile unit tests for priorities, pins, timeline, share text, assigned-status notification,
  background/resume orchestration, and existing storage/poll/query paths; typecheck, Expo
  dependency check, web/native bundle checks, and rendered web preview inspection;
- requirement-by-requirement evidence recorded in the demo/readme documentation;
- clean worktrees, intentional commits, fetch-before-push, and successful pushes of `main`,
  `backend`, `frontend`, and `mobile`.

## Scope guardrails

Do not modify `contract/`, parser rules, fingerprint normalization, or golden corpus counts. Do not
introduce real FCM/APNs credentials or require a paid service. Do not replace the three-branch
structure with a monorepo. New UI must preserve the established visual language and remain
scannable under demo pressure.
