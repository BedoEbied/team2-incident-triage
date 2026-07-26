# Remaining Tasks — Team 2, AI Incident & Log Triage

Handoff snapshot. Read this alongside [`README.md`](README.md) (overview),
[`DEMO.md`](DEMO.md) (walkthrough + requirements traceability), and
`contract/` (frozen API + design tokens — do not edit).

Repo: https://github.com/BedoEbied/team2-incident-triage (private)
Worktrees: `~/triage-backend` (branch `backend`), `~/triage-web` (branch `frontend`),
`~/triage-mobile` (branch `mobile`)

**As of this snapshot, all three branches are committed and clean** — no
uncommitted changes anywhere, no background agents running. Confirmed
immediately before writing this file:

| branch | last commit | tests | tsc |
|---|---|---|---|
| `backend` | `117dc3f` clean orphaned upload files on startup | 19/19 | clean |
| `frontend` | `1f38162` fix severity accent border color | 14/14 | clean |
| `mobile` | `4e014cc` fix header seam + filter overflow clipping | 12/12 | clean |

`main` (this worktree) has three unpushed commits on top of the original
freeze — **push everything before or as the first step of continuing work**:

```bash
cd ~/incident-triage && git push origin main
cd ~/triage-backend && git push origin backend
cd ~/triage-web && git push origin frontend
cd ~/triage-mobile && git push origin mobile
```

---

## 1. Highest priority — AI analyzer chain was never built

`briefs/ai-analyzer.md` (in this repo) specifies a full Chain-of-Responsibility
analyzer: OpenAI SDK (structured outputs) → `claude` CLI (no key needed,
subscription-authed on this machine) → the existing deterministic rule engine
as a guaranteed-available fallback. **This was queued to build automatically
but the queue was killed** (mid-session the operator said "skip using codex
now," and the launcher for this specific pass — `queue-ai.sh` — was stopped
before it ever started codex). The backend currently ships **rule-based
analysis only** (`src/infra/rule-analyzer.ts`), which the PDF's headline
requirement ("Analyze the uploaded logs using AI") does not fully satisfy.

**To implement:** read `briefs/ai-analyzer.md` in full — it already specifies
the design, the prompt-injection defenses (log text is untrusted input),
the shell-out safety rules for the `claude` CLI provider (argv array, stdin
prompt, never a shell string), and the non-negotiable invariants (893 entries
/ 10 incidents / 661 largest must never change; chain must behave identically
with no key and no `claude` binary). Do not skip the "do not touch the
parser or grouper" constraint — this is additive only.

No `OPENAI_API_KEY` was ever set in this session's environment. `claude` CLI
is installed and subscription-authed — that alone is enough to demo real LLM
output with zero setup cost.

## 2. Mobile — one visual re-check needed

Just fixed (commit `4e014cc` on `mobile`, 24 min old at time of writing):

- **Appbar/page background seam**, present on every screen: the header used
  `canvas.surface` (white) while the body used `canvas.page` (bone),
  producing a harsh unbranded line under the title bar. Now both use
  `canvas.page`, matching web's borderless header treatment.
- **Filter row clipping** — `SegmentedButtons` divides its row width evenly
  regardless of label count/length. Five severity options overflowed a
  375px screen and clipped "Low" off the edge entirely (untappable,
  unreachable — a real accessibility break of a PDF-required filter). Built
  `src/features/incidents/FilterChipRow.tsx`: chips self-size to their label
  and the row scrolls horizontally instead of truncating. Used on both the
  Dashboard (severity/status/sort) and the Incident Detail screen (status).

**Verified live** on the Dashboard screen via `expo start --web` +
a phone-sized browser viewport (the iOS Simulator integration is blocked
this session — see §4). **Not yet visually re-confirmed** on the Incident
Detail screen after the same edit — the change there is mechanically
identical (same component, same props) and `tsc`/tests are clean, but
web-preview routing didn't let this session deep-link to
`/incident/[id]` to actually look at it. Before considering mobile fully
polished:

```bash
cd ~/triage-mobile && npx expo start --web --port 8090
# sign in (oncall@demo.io / demo1234), tap an incident card, confirm:
#   - header blends into the bone canvas (no white seam)
#   - the Status filter row shows New / Investigating / Resolved fully,
#     none clipped, chip-style with checkmark on selection
```

Ideally verify on the real Simulator instead (see §4) — closer to what
judges will actually run.

### Dev-only additions from this pass — decide whether to keep

To do the visual QA above, this session added `react-native-web`,
`react-dom`, and `@expo/metro-runtime` as dependencies (`package.json` /
`package-lock.json`), and a **web-only** `localStorage` fallback in
`src/storage/token.ts` (native iOS/Android still go through
`expo-secure-store` exclusively — the fallback is gated on
`Platform.OS === 'web'` and never runs on device). This is a real, if small,
scope question: the mobile PDF asks for Android/iOS only, so a judge
reading `package.json` may reasonably ask why `react-native-web` is there.

- **Keep**: costs nothing at runtime on native, useful for any future QA
  without a simulator.
- **Strip**: `npm uninstall react-native-web react-dom @expo/metro-runtime`,
  revert `src/storage/token.ts` to the plain `SecureStore`-only version, and
  do all further visual QA exclusively via the Simulator once unblocked.

No opinion recorded from the operator yet — flag it, don't decide silently.

## 3. iOS Simulator blocked — needs the operator's password

Every `attach` attempt this session returned the same error:

```
Xcode is installed but not selected. Run
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
```

`xcode-select -p` and `xcodebuild -license status` both check out clean in
a plain shell — this is a mismatch specific to whatever the simulator
integration checks, not a real missing-Xcode problem. The exact command
above needs to be run by the operator (needs `sudo`); retry `attach` after.
Once unblocked, do a full native pass: login persistence, pull-to-refresh,
notification tap → deep link, acknowledge/assign/notes/history, and the two
fixes in §2.

## 4. Smaller, lower-priority items

- **`triage-web/package.json` has no `test` script.** Tests exist
  (`src/**/*.test.mjs`, 14/14 passing) and were run via
  `node --test src/**/*.test.mjs` directly all session. Add
  `"test": "node --test src/**/*.test.mjs"` to scripts for a normal
  `npm test` entry point.
- **10 moderate `npm audit` findings on mobile** — transitive `uuid`
  dependency. The hardening pass deliberately declined
  `npm audit fix --force` because it would force a breaking downgrade to
  Expo 46. Documented in `triage-mobile/NOTES.md`. Leave as-is unless a
  non-breaking fix appears upstream.
- **`OPENAI_API_KEY` never set/tested this session.** If §1 is implemented,
  the OpenAI provider path is code-complete but untested live — the
  `claude`-CLI and rule-engine paths are what actually get exercised without
  a key.
- **Web bundle size warning** (`npm run build` on `frontend`): main JS chunk
  is 967 kB / 284 kB gzipped, above Vite's 500 kB advisory threshold.
  Not a correctness issue, not blocking — flagged in case there's time for
  `manualChunks` code-splitting before judging.

## 5. Deferred by design — not oversights, already stated in `DEMO.md`

Call-graph (`graph.json`) enrichment of root-cause text, CSV/PDF export,
incident heatmap, expandable inline groups, real FCM/APNs push (local
notifications are used instead), background sync workers, generated OpenAPI
docs, broad test coverage beyond the parser/contract-critical paths.

---

## Suggested order for whoever picks this up

1. Push all four branches (top of this file).
2. Decide §2's keep/strip question for the web-preview deps — quick.
3. If time allows before judging: §1 (AI analyzer chain) is the single
   highest-value remaining task — it's the PDF's headline feature and is
   fully specified in `briefs/ai-analyzer.md`, just not yet built.
4. Visual re-check per §2, ideally after §3 (Simulator unblocked).
5. `bash scripts/smoke.sh` against a freshly booted backend as a final
   sanity pass before demo — must still show 12/12 passing, 893 entries,
   661 largest incident.
