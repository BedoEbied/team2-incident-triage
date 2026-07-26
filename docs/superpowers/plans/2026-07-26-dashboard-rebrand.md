# Dashboard Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the warm Luciq-inspired brand to the existing dashboard without changing any
data, API, filter, mutation, component, or UTC behavior.

**Architecture:** Copy the shared contract tokens verbatim, rebuild Mantine around those tokens
and a light/dark CSS-variable resolver, then apply narrow presentation classes to the existing
components. A source-level brand-contract test guards the visual requirements and the existing
date tests guard the UTC hardening.

**Tech Stack:** React 19, TypeScript 5.8, Mantine 8.3.14, Vite 7, Node test runner, CSS

---

### Task 1: Add the failing brand contract

**Files:**

- Create: `src/theme/brand.test.mjs`

- [ ] **Step 1: Write the failing source-contract test**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('local theme uses the shared warm brand contract', () => {
  const contract = read('../../contract/tokens.ts');
  const local = read('./tokens.ts');
  const theme = read('./theme.ts');
  const styles = read('../styles.css');
  const dashboard = read('../pages/Dashboard.tsx');
  const analytics = read('../components/AnalyticsRow.tsx');
  const date = read('../utils/date.ts');

  assert.equal(local, contract);
  assert.match(theme, /fontFamily: FONT_UI/);
  assert.match(theme, /fontFamilyMonospace: FONT_MONO/);
  assert.match(theme, /fontFamily: FONT_DISPLAY/);
  assert.match(theme, /primaryColor: 'brand'/);
  assert.match(theme, /fontWeight: '400'/);
  assert.match(styles, /background: var\(--triage-page\)/);
  assert.match(styles, /\.stat-number[\s\S]*font-weight: 400/);
  assert.match(styles, /\.brand-mark[\s\S]*var\(--triage-lime\)/);
  assert.match(styles, /\.incident-row--accent td:first-child[\s\S]*3px solid/);
  assert.match(dashboard, /brand-mark/);
  assert.match(analytics, /stat-number/);
  assert.match(date, /timeZone: UTC/);
  assert.doesNotMatch(`${theme}\n${styles}`, /linear-gradient|#6200EE|#BB86FC/i);
});
```

- [ ] **Step 2: Run the test and confirm the old theme fails**

Run: `node --test src/theme/brand.test.mjs`

Expected: FAIL at `assert.equal(local, contract)` because the frontend still contains the old
frozen token copy.

- [ ] **Step 3: Commit the red test**

```bash
git add src/theme/brand.test.mjs
git commit -m "test: define dashboard brand contract"
```

### Task 2: Rebuild the theme foundation

**Files:**

- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/theme.ts`
- Modify: `src/main.tsx`
- Modify: `index.html`

- [ ] **Step 1: Replace the local tokens with the contract contents**

Apply the complete contents of `contract/tokens.ts` to `src/theme/tokens.ts` without changing the
relative `./types` import.

- [ ] **Step 2: Define the Mantine theme and scheme variables**

```ts
import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';
import {
  BRAND,
  CANVAS,
  DENSITY,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_UI,
  RADIUS,
} from './tokens';

const brand = [
  '#EAF5FF',
  '#D7ECFF',
  '#BEE0FE',
  BRAND.blueSoft,
  '#5CB4FF',
  '#32A0FD',
  BRAND.blue,
  '#0877DD',
  '#0566C1',
  '#034C92',
] as const satisfies MantineColorsTuple;

export const theme = createTheme({
  fontFamily: FONT_UI,
  fontFamilyMonospace: FONT_MONO,
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'sm',
  radius: {
    xs: '4px',
    sm: `${RADIUS.control}px`,
    md: `${RADIUS.panel}px`,
    lg: `${RADIUS.panel}px`,
    xl: `${RADIUS.panel}px`,
  },
  fontSizes: {
    xs: `${DENSITY.headerFontSize}px`,
    sm: `${DENSITY.fontSize}px`,
    md: '14px',
  },
  headings: {
    fontFamily: FONT_DISPLAY,
    fontWeight: '400',
    sizes: {
      h1: { fontSize: '32px', lineHeight: '1.05', fontWeight: '400' },
      h2: { fontSize: '22px', lineHeight: '1.15', fontWeight: '400' },
      h3: { fontSize: '18px', lineHeight: '1.2', fontWeight: '400' },
    },
  },
  colors: { brand },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--triage-display': FONT_DISPLAY,
    '--triage-ui': FONT_UI,
    '--triage-mono': FONT_MONO,
    '--triage-blue': BRAND.blue,
    '--triage-lime': BRAND.lime,
  },
  light: {
    '--mantine-color-body': CANVAS.light.page,
    '--mantine-color-text': CANVAS.light.text,
    '--mantine-color-dimmed': CANVAS.light.textDim,
    '--mantine-color-default': CANVAS.light.surface,
    '--mantine-color-default-hover': CANVAS.light.surfaceAlt,
    '--mantine-color-default-color': CANVAS.light.text,
    '--mantine-color-default-border': CANVAS.light.border,
    '--triage-page': CANVAS.light.page,
    '--triage-surface': CANVAS.light.surface,
    '--triage-surface-alt': CANVAS.light.surfaceAlt,
    '--triage-border': CANVAS.light.border,
    '--triage-text': CANVAS.light.text,
    '--triage-dim': CANVAS.light.textDim,
    '--triage-accent-row': CANVAS.light.accentRow,
    '--triage-focus': CANVAS.light.focus,
  },
  dark: {
    '--mantine-color-body': CANVAS.dark.page,
    '--mantine-color-text': CANVAS.dark.text,
    '--mantine-color-dimmed': CANVAS.dark.textDim,
    '--mantine-color-default': CANVAS.dark.surface,
    '--mantine-color-default-hover': CANVAS.dark.surfaceAlt,
    '--mantine-color-default-color': CANVAS.dark.text,
    '--mantine-color-default-border': CANVAS.dark.border,
    '--triage-page': CANVAS.dark.page,
    '--triage-surface': CANVAS.dark.surface,
    '--triage-surface-alt': CANVAS.dark.surfaceAlt,
    '--triage-border': CANVAS.dark.border,
    '--triage-text': CANVAS.dark.text,
    '--triage-dim': CANVAS.dark.textDim,
    '--triage-accent-row': CANVAS.dark.accentRow,
    '--triage-focus': CANVAS.dark.focus,
  },
});
```

- [ ] **Step 3: Pass the resolver to the existing provider**

```tsx
<MantineProvider
  cssVariablesResolver={cssVariablesResolver}
  defaultColorScheme="light"
  theme={theme}
>
```

- [ ] **Step 4: Load both fonts with fallbacks left in the token stacks**

Add preconnect hints and a Google Fonts stylesheet for Instrument Sans weights 400/500/600 and
Instrument Serif regular/italic to `index.html`. Do not remove any system fallback from the
token strings.

- [ ] **Step 5: Run type-check, build, and contract test**

Run:

```bash
node --test src/theme/brand.test.mjs
npx tsc --noEmit
npm run build
```

Expected: the brand test still fails only on component/CSS assertions; TypeScript and build exit
0.

- [ ] **Step 6: Commit the theme foundation**

```bash
git add index.html src/main.tsx src/theme/tokens.ts src/theme/theme.ts
git commit -m "style: rebuild Mantine theme for warm brand"
```

### Task 3: Apply branded component presentation

**Files:**

- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/components/AnalyticsRow.tsx`
- Modify: `src/components/IncidentTable.tsx`
- Modify: `src/components/DetailDrawer.tsx`
- Modify: `src/components/UploadBar.tsx`
- Modify: `src/components/SeverityBadge.tsx`
- Modify: `src/components/StatusPill.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add the single signature mark and remove page-local theme variables**

Place `<span className="brand-mark" aria-hidden="true" />` beside the existing page title. Keep
the title/subtitle copy, upload component, and scheme toggle behavior unchanged. Remove the
inline page variable object because the provider now owns it.

- [ ] **Step 2: Apply the display and mono roles**

Use `className="stat-number"` on the total incident number, `className="section-heading"` for
analytics and drawer section headings, and retain `.mono` on timestamps, counts, codes, modules,
and raw entries. Remove `.mono` from the total incident number.

- [ ] **Step 3: Apply brand interactions and dense geometry**

Make Upload logs the filled primary action; use brand-colored loaders; set badge radii to
`RADIUS.control`; set table rows to `DENSITY.rowHeight`; and keep every event handler, query
update, callback, label, and UTC formatter unchanged.

- [ ] **Step 4: Implement the presentation classes**

```css
.surface {
  background: var(--triage-surface);
  border: 1px solid var(--triage-border);
  border-radius: 16px;
}

.brand-mark {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--triage-lime);
}

.section-heading {
  color: var(--triage-text);
  font-family: var(--triage-display);
  font-size: 17px;
  font-weight: 400;
}

.stat-number {
  font-family: var(--triage-display);
  font-size: 40px;
  font-weight: 400;
}

.incident-row {
  height: 40px;
}

.incident-row:focus-visible {
  outline: 2px solid var(--triage-focus);
}

.incident-row:hover {
  background: var(--triage-surface-alt);
}

.incident-row--accent td:first-child {
  border-inline-start: 3px solid var(--severity-accent);
}
```

Complete the stylesheet with warm Drawer/input/chart treatment, 8px small-control radius,
responsive header/upload behavior, and no gradients or purple/violet hex values.

- [ ] **Step 5: Run the brand and UTC suites**

Run:

```bash
node --test src/theme/brand.test.mjs
TZ=Africa/Cairo node --test src/utils/date.test.mjs src/api/incidentQuery.test.mjs
TZ=America/Los_Angeles node --test src/utils/date.test.mjs src/api/incidentQuery.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 6: Run compiler/build verification and commit**

Run:

```bash
npx tsc --noEmit
npm run build
git diff --check
```

Expected: every command exits 0.

```bash
git add src/pages/Dashboard.tsx src/components/AnalyticsRow.tsx \
  src/components/IncidentTable.tsx src/components/DetailDrawer.tsx \
  src/components/UploadBar.tsx src/components/SeverityBadge.tsx \
  src/components/StatusPill.tsx src/styles.css
git commit -m "style: apply warm editorial dashboard brand"
```

### Task 4: Final visual and repository verification

**Files:**

- Verify: `src/`
- Verify: `index.html`
- Verify: `dist/`
- Verify: Git worktree

- [ ] **Step 1: Refresh the structural index**

Run: `graphify auto-update .`

Expected: edited TypeScript/TSX files are re-indexed without errors.

- [ ] **Step 2: Run the complete automated gate**

```bash
node --test 'src/**/*.test.mjs'
TZ=Africa/Cairo node --test src/utils/date.test.mjs src/api/incidentQuery.test.mjs
TZ=America/Los_Angeles node --test src/utils/date.test.mjs src/api/incidentQuery.test.mjs
npx tsc --noEmit
npm run build
```

Expected: all test files pass and both build commands exit 0.

- [ ] **Step 3: Run banned-style and palette checks**

```bash
rg -n -i --glob '!node_modules/**' --glob '!dist/**' \
  'linear-gradient|radial-gradient|conic-gradient|#6200ee|#bb86fc|#7c3aed|#8b5cf6|#a78bfa' \
  src index.html
rg -n '#FBF8F6|#0B0B0A|font-weight: 400|3px solid|timeZone: UTC' \
  src contract/tokens.ts
```

Expected: the banned search returns no results; the required search returns the light/dark
canvas, serif weight, severity accent, and UTC formatter.

- [ ] **Step 4: Inspect the dashboard in light, dark, responsive, and offline states**

Start `npm run dev`, open the dashboard, verify the specified palette and typography in both
schemes, narrow to a mobile viewport, disable network, and reload. Confirm no layout shift breaks
the header, analytics, filters, table, or drawer when fallbacks render.

- [ ] **Step 5: Review the final diff and worktree**

Run:

```bash
git diff HEAD~3 -- src index.html docs
git status --short
```

Expected: only the approved rebrand/test/docs files and the pre-existing dirty
`contract/tokens.ts` are present; no data or date source changed.
