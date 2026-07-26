# Dashboard Rebrand Design

## Intent

Restyle the existing incident-triage dashboard as a refined, editorial operational tool without
changing its component structure, data flow, API calls, mutations, filtering, sorting, or UTC
date handling. The memorable visual cues are the warm bone page canvas and regular-weight serif
display typography.

## Direction

Use a theme-first hybrid approach:

- Copy `contract/tokens.ts` verbatim to `src/theme/tokens.ts`, preserving the local
  `src/theme/types.ts` import target.
- Rebuild the Mantine theme around `FONT_UI`, `FONT_DISPLAY`, `FONT_MONO`, the electric-blue
  primary ramp, 8px controls, and 16px panels.
- Map Mantine's semantic light/dark CSS variables to the token canvas so built-in controls and
  overlays inherit the warm brand in both schemes.
- Keep component markup stable and use narrow class/style adjustments where dense tables,
  charts, semantic badges, and the header need more precise presentation.

This approach keeps brand values centralized while avoiding a broad component rewrite or
behavioral regression.

## Typography

- Load Instrument Serif and Instrument Sans as web fonts, with the complete token fallbacks left
  intact so offline rendering remains usable and stable.
- Product title, section headings, and primary stat numbers use `FONT_DISPLAY` at weight 400.
- Table cells, labels, controls, buttons, and filters use `FONT_UI`.
- Timestamps, counts, codes, modules, log lines, and stack traces use `FONT_MONO`.
- Dense operational sizing remains: 13px body copy and 40px table rows.

## Color and Surfaces

- Light page: `#FBF8F6`; light surface: `#FFFFFF`; light alternate surface: `#F2EDE9`;
  light border: `#ECE7E3`; ink: `#070707`; supporting text: `#6D6864`.
- Dark page: `#0B0B0A`; dark surface: `#141412`; dark alternate surface: `#1C1B18`;
  dark border: `#2A2724`; primary text: `#F2EDE9`; supporting text: `#8F8983`.
- Electric blue `#0A89FC` is reserved for primary action, active/focus state, links, progress,
  and Investigating.
- Acid lime `#B6FA05` appears once as a small non-semantic product mark in the header.
- Severity colors remain restricted to badges, charts, and the Critical/High row accent.
- Panels use borders and no stacked shadows, blur, glass treatment, or gradients.

## Components

- Header: retain the existing title, subtitle, upload flow, and theme control; add one small lime
  brand mark beside the title.
- Analytics: keep the same five charts/stat panels and their data transforms. The total number
  becomes 40px display serif at weight 400; chart colors come only from the token series/status
  colors.
- Filters: retain every control and UTC date conversion; use branded control radius, focus,
  selected state, and compact spacing.
- Incident table: preserve selection, keyboard behavior, labels, columns, and UTC formatting.
  Rows become 40px and Critical/High retain a visible 3px severity accent in both schemes.
- Drawer and upload: preserve all query/mutation behavior; align headings, machine text, actions,
  borders, and progress treatment with the shared theme.

## Data and Error Behavior

No data path changes. React Query keys, request functions, mutation callbacks, filter updates,
sorting, empty/loading/error states, and retry controls remain intact. `formatUtcTimestamp`,
`formatUtcDateLabel`, and `toUtcDateKey` remain unchanged and continue to be the only
presentation/filter date path.

## Verification

- Add a static brand-contract test first, confirm that it fails against the old theme, and use it
  to guard verbatim tokens, warm scheme colors, serif display weight, radii, font loading, banned
  gradients/purple hexes, table row density, visible severity accents, and untouched UTC helpers.
- Run all existing Node tests under at least two non-UTC host timezones.
- Run `npx tsc --noEmit` and `npm run build`.
- Inspect the built page in both schemes and at desktop/mobile widths, then reload with network
  access disabled to validate font fallbacks and layout stability.
