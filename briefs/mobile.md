# BRIEF — Mobile App (branch `mobile`)

You are building the mobile app for **Team 2**'s competition entry: an AI-powered incident and
log triage tool for on-call engineers who need to respond away from their desk. You have roughly
**25 minutes**. Work only in your current directory.

Read `contract/api.md`, `contract/types.ts`, `contract/tokens.ts` and `contract/mock.json` first.
They are frozen.

## Stack

Expo (latest SDK) + expo-router + TypeScript (`strict: true`) + **React Native Paper** +
`expo-secure-store` + `expo-notifications` + `@react-native-async-storage/async-storage` +
TanStack Query. Must run in Expo Go.

## Build against the mock from minute zero

`contract/mock.json` is generated from the **real** 893-entry log corpus — 10 incidents whose
occurrences sum to 893, including a 661-occurrence Critical. **Do not wait for the backend.**

`src/api/client.ts` is the only module that talks HTTP or reads the mock. Export a single
`API_BASE` / `USE_MOCK` switch at the top.

**`API_BASE` must be the machine's LAN IP, not `localhost`** — a phone or simulator cannot reach
the host's `localhost`. Put it in one constant with a comment saying so.

## Layout

```
app/(auth)/login.tsx
app/(app)/index.tsx
app/(app)/incident/[id].tsx
src/api/client.ts  src/api/types.ts
src/theme/tokens.ts  src/theme/paperTheme.ts
src/storage/token.ts        TokenStorage interface + SecureStore implementation
src/storage/cache.ts        AsyncStorage offline list cache
src/notify/poll.ts          NotificationPort interface + expo-notifications implementation
src/features/incidents/     list, detail, filters
```

Routes under `app/` stay thin — no data fetching or business logic in a route file.

`TokenStorage` and `NotificationPort` are interfaces because both wrap platform APIs that
cannot run in a test. That is the DIP seam worth having here; do not add others.

## Screens

**Login** — email + password → `POST /auth/login`. Store the JWT with `expo-secure-store`
(secure token storage is an explicit requirement — not AsyncStorage). Restore the session on
launch and route straight to the dashboard when a token exists.
Demo credentials: `oncall@demo.io` / `demo1234`.

**Dashboard** — four summary tiles: total active incidents, Critical count, High count, and
count currently Investigating. Below them the incident list: title, AI summary, severity chip,
status chip, occurrences, last seen. Critical and High visually highlighted with a left accent
bar in the severity colour. Pull-to-refresh. Search by title/summary, filter by severity and
status (`SegmentedButtons`), sort by severity or last occurrence.

**Detail** — AI summary, AI explanation, severity, current status, root cause, suggested
remediation, related log entries (monospace), occurrences, first and last occurrence. Actions:
change status, **acknowledge**, **assign to me** (`PATCH` with `assigneeId`), add a note, and a
history list rendered from the incident's `activity` records.

**Notifications** — poll `GET /incidents` on an interval; when a Critical or High incident
appears that was not in the previous snapshot, fire a **local** notification via
`expo-notifications` (`setNotificationHandler` + `scheduleNotificationAsync`). Tapping it deep
links to `/incident/[id]`. No FCM/APNs credentials — local notifications only, so it works in
Expo Go.

**Offline** — cache the last incident list in AsyncStorage and render from it when the network
is unavailable, so the app degrades gracefully instead of showing an error screen.

## UI rules — binding, see `contract/tokens.ts`

**React Native Paper ships a purple Material 3 theme by default. Shipping it is a failure
condition.** Build a custom MD3 theme from `contract/tokens.ts` — `CANVAS`, `SEVERITY_COLORS`,
`STATUS_COLORS`, `RADIUS`, `FONT_MONO` — with both a light and a dark variant.

**Banned:** gradients (especially purple→pink), glassmorphism, stacked shadows, neon or pastel
colours, emoji as icons, "AI sparkle" motifs, pill radius on everything, airy spacing.

**Required:** borders over shadows, radius 4px, dense rows, and monospace for log lines, stack
traces, error codes and timestamps.

Components to use: `Appbar`, `Card` for incident rows, `Chip` for severity and status,
`List.Section` for detail fields, `Searchbar`, `SegmentedButtons` for filters, `FAB` for
assign-to-me, `Snackbar` for confirmations.

Delete every leftover file and style from the Expo template.

## Minute budget

| min | deliverable |
|---|---|
| 0–6 | scaffold, custom Paper theme from tokens, login + SecureStore |
| 6–14 | dashboard tiles + list + search/filter/sort + pull-to-refresh |
| 14–20 | detail + status + acknowledge + assign-to-me + notes + history |
| 20–24 | polling → local notification on new Critical/High + deep link |
| 24–25 | AsyncStorage offline cache |

If you fall behind, cut in this order: pin/favourite, share summary, background sync. Protect
login, list, detail and status change.

## Acceptance

1. Runs in Expo Go against the mock with the backend **down**
2. Session survives an app restart (token read back from SecureStore)
3. Status change round-trips and the history list shows the change
4. A local notification fires for a new Critical/High and tapping it opens that incident
5. The Paper theme is the custom one — **no MD3 purple anywhere**
6. `npx tsc --noEmit` is clean

---

## Standing instructions

Work only inside your current working directory. **Do not modify `contract/`** — it is frozen;
if the API disagrees with it, fix your own code. Commit to the current branch as you go with
small messages. If blocked, write your best working approximation and record the blocker in
`NOTES.md` rather than stopping. Do not run `git push`, `git merge`, `git rebase`, or touch
other branches.
