# Mobile Hardening and Rebrand Design

## Scope and constraints

This pass updates the existing Expo mobile client without changing its overall architecture. The
app remains an Expo Router application with React Native Paper, TanStack Query, SecureStore for the
JWT, and AsyncStorage only for the incident-list cache. Routes under `app/` remain adapters that
render feature screens.

The target user is an on-call engineer scanning and acting on incidents under time pressure. The
interface should feel warm, precise, editorial, and operational: warm bone surfaces, near-black
ink, restrained blue interaction color, a tiny acid-lime brand mark, serif display typography,
compact sans-serif controls, and monospace machine output.

The user-provided task is the approved product and visual specification. The standing instruction
to proceed without an approval pause applies to this design.

## Chosen approach

### Brand tokens and fonts

`contract/tokens.ts` remains untouched. Its contents are copied byte-for-byte to
`src/theme/tokens.ts`. Because that copied file imports `./types`, a thin
`src/theme/types.ts` type re-export preserves the verbatim copy without changing the contract.

The token font values are CSS-style fallback stacks and cannot be passed directly to React Native.
A small native adapter maps the three token roles to:

- `InstrumentSerif_400Regular` for display text when the bundled font loads;
- `InstrumentSans_400Regular` and `InstrumentSans_600SemiBold` for UI text when loaded;
- platform monospace and system UI/display fallbacks when font loading reports an error or is
  still in progress.

The app renders immediately with fallbacks, then applies the bundled font names after `useFonts`
reports success. No network is needed because the Google Fonts packages ship the TTF assets in the
bundle.

The Paper MD3 theme is built as a complete object instead of spreading either default MD3 theme.
Every color role is assigned from the warm canvas, blue interaction ramp, or the defined Critical
severity color for Paper's error role. This prevents any default purple role from leaking through.
Theme roundness is 8. Large feature panels use 16 explicitly.

### Correctness and state

One UTC formatter owns every date-time conversion. It uses an explicit `en-US` locale,
`timeZone: 'UTC'`, and an appended `UTC` label. List, detail, log, and history timestamps all call
it; First seen and Last seen labels also include `(UTC)`.

One pure incident-query helper composes search, severity, status, module, and sorting. The mock API
and cached-list fallback both use it. Successful filtered requests do not replace the full offline
cache with a subset. Dashboard rendering distinguishes:

- initial loading with no rows;
- an initial request failure with no cache;
- a successful empty filter result;
- cached rows retained after a failed refresh.

Pull-to-refresh calls the active query's `refetch`, so it always asks the server again for the
current filter state.

The detail screen distinguishes initial loading, missing/error, and loaded data with a failed
refetch. Mutation failures appear in the existing Snackbar and do not crash the screen.

All incident, log-entry, and history lists continue to use their stable IDs as keys.

### Polling, authentication, and deep links

The poll scheduler is split from the Expo notification adapter so its lifecycle can be tested with
fake timers. Starting with a missing token is a no-op. Starting a new poller first stops the old
one, and the cleanup returned to the dashboard is idempotent. Dashboard unmount and token removal
therefore stop the interval before the authenticated route disappears.

The JWT remains only in SecureStore and transient React memory. A small storage adapter test proves
that logout's `clearToken` maps to `SecureStore.deleteItemAsync` using the one JWT key. AsyncStorage
continues to store only incident data.

Expo Router keeps the existing `/incident/[id]` route and custom `triage` scheme. The root
notification observer handles the last notification response and live responses, ignores invalid
payloads, and removes its listener. The route itself stays thin and normalizes a possibly repeated
`id` parameter before handing it to the detail screen. Expo Router's native-link handling provides
cold-start routing for the same path.

### Untrusted and long log text

Log messages and stack traces remain React Native `Text`, so they are never interpreted as markup.
Each machine-output block is selectable monospace text inside a horizontal ScrollView, while the
screen owns vertical scrolling. Long unbroken lines therefore scroll horizontally instead of
expanding or clipping the layout.

### Error boundaries and API robustness

The API client parses response bodies as `unknown`, creates a typed error carrying HTTP status and
contract error code, and supplies a safe message for invalid or empty error bodies. A failed or
401 list request is presented as a warning while cached incident rows remain visible.

`API_BASE` remains the single exported top-level endpoint constant with an explicit comment that a
device cannot reach the development machine through `localhost` and must use the machine's LAN IP.

## Alternatives considered

1. Import tokens directly from `contract/`. This is smallest, but it does not satisfy the explicit
   verbatim-copy requirement and keeps production styling coupled to the frozen contract folder.
2. Edit the copied token import path. This compiles with one file, but the copy is no longer
   verbatim.
3. Replace the dashboard with a centralized store and client-only filtering. This could simplify
   some cache behavior, but it is a prohibited restructuring of working code. The chosen pure
   helper gives the needed composition and cache correctness without changing the screen model.

## Verification

Automated checks cover UTC invariance, composed filtering/sorting, poller cleanup/no-token behavior,
and secure-token deletion. Final verification also runs the full test command, TypeScript,
`expo install --check`, an Expo bundle build/start smoke check, byte comparison of the token copy,
banned-theme/color greps, source checks for display font size/weight, stable keys, and storage
separation.
