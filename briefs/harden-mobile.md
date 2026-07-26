# HARDENING + REBRAND PASS — Mobile App (branch `mobile`)

The app is built, committed, `tsc --noEmit` is clean and `expo install --check` passes. This pass
does two things: apply a new brand identity, and harden correctness. **Do not restructure working
code.** Commit in small, separate commits.

---

## PART 1 — Rebrand (do this first, it is the visible half)

`contract/tokens.ts` **has been rewritten on `main` with a new brand identity.** Re-copy it into
`src/theme/tokens.ts` verbatim, then rebuild the Paper theme from it.

The brand is adapted from the Luciq design language. Its character:

- **A warm bone canvas (`#FBF8F6`)** — never cold grey, never pure white. This is the single most
  recognisable thing about the brand. Get it right and the rest follows.
- **Near-black ink (`#070707`)** for text, warm grey (`#6D6864`) for supporting text.
- **A serif display face at REGULAR weight (400)** for screen titles and big numbers — the four
  dashboard summary tiles should use it at ~40px. Not bold. The elegance is in the letterforms,
  not the weight. This is the second most recognisable thing.
- **A neutral grotesque** for UI text, **monospace** for log lines, stack traces, codes, timestamps.
- **Electric blue (`#0A89FC`)** as the interactive accent: active filter chips, links, primary
  actions, focus.
- **Acid lime (`#B6FA05`)** as the signature brand mark, used sparingly — a small logo mark in the
  Appbar, or a live/connected dot. **Never for severity or status.** It must never read as a
  semantic state.
- **Radius 8px** for controls and cards, 16px for large panels. Not pills.
- **Warm-tinted dark mode** (`#0B0B0A` page, `#141412` surface, `#2A2724` border) — a warm brand
  does not flip to neutral charcoal.

Fonts: `FONT_DISPLAY`, `FONT_UI`, `FONT_MONO` are exported from tokens. Load `Instrument Serif`
and `Instrument Sans` with `expo-font` / `@expo-google-fonts`, and make sure the app still renders
correctly with the system fallback if fonts fail to load — the demo may run without network.

### Still banned

Gradients of any kind. **Purple/violet anywhere** — React Native Paper's default MD3 purple must
be fully overridden, in both light and dark. Glassmorphism, blur panels, stacked shadows. Neon or
candy colours beyond the two brand accents. Emoji as iconography. "AI sparkle" motifs. Cold grey
backgrounds. Bold display headings. Airy marketing spacing — this is a triage tool.

Severity and status colours come from `SEVERITY_COLORS` / `STATUS_COLORS` only. Note `Low` is
warm grey by design: a triage list should not shout about low-severity noise.

---

## PART 2 — Hardening

### Timestamps — a confirmed cross-client defect

The source logs carry **no timezone**. The backend treats them as UTC and emits ISO 8601 with `Z`.
On the web client this was rendering in local time and shifting dates by a day: a log line written
`2026-05-16 23:51:08` displayed as `May 17, 02:51 AM` in `Africa/Cairo`.

Render **every** timestamp in UTC. Pass `timeZone: 'UTC'` to every formatter, centralise it in one
helper, and label it (e.g. `First seen (UTC)`) so it is unambiguous. Check the list, the detail
screen and the history entries.

### Correctness

- Every list render keys off a stable `incident.id`, never an array index and never the title —
  two incidents legitimately share similar titles.
- Loading, empty and error states are distinguishable on the dashboard and detail screen.
  "No incidents match these filters" must not look like "still loading" or "request failed".
- Search + severity filter + status filter + sort compose correctly; clearing one restores rows.
- Pull-to-refresh reflects server changes made elsewhere (e.g. a status changed on the web).
- The notification poller must clear its interval on unmount and on sign-out, or it leaks timers
  and keeps firing after logout.
- Deep-linking into `/incident/[id]` must work from a cold start, not just when the app is warm.

### Security and robustness

- The JWT lives in SecureStore, never AsyncStorage and never in plain app state that gets
  persisted. Confirm sign-out actually clears it.
- Log text is untrusted input. Render stack traces as plain text in a scrollable monospace block;
  never interpret them as markup.
- Long messages and stack traces must not break layout — they scroll on their own axis.
- Handle a failed or unauthorised request without a crash: show a message and keep the cached list.
- Confirm `API_BASE` is a single top-level constant documented as needing the machine's **LAN IP**,
  not `localhost`, with a comment saying why.

### Hygiene

- Delete leftover Expo template files, unused imports, dead code, commented-out blocks, stray
  `console.log`.
- No `any` crossing a module boundary.
- Routes under `app/` stay thin — no data fetching or business logic in a route file.

---

## Verification before you finish

1. `npx tsc --noEmit` exits 0
2. `npx expo start` builds the bundle without error
3. Grep the whole tree for purple: no `#6200EE`, no `#BB86FC`, no default MD3 theme import
   surviving in either light or dark
4. The four summary tiles render in the serif display face at weight 400
5. Timestamps are identical regardless of device timezone
6. Sign out, confirm the token is gone from SecureStore and the poller has stopped

Report what you changed, and anything you deliberately left alone.

---

## Standing instructions

Implement and commit in small messages. **Never stop to ask for approval — you have it.** Work
only in your current directory. **Do not modify `contract/`** — copy from it. If something is
genuinely impossible, implement the closest working alternative and note it in `NOTES.md`; do not
halt. No `git push`, `merge`, `rebase`, or other branches.
