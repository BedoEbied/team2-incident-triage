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
  assert.match(
    styles,
    /\.incident-row--accent td:first-child[\s\S]*3px solid/,
  );
  assert.match(dashboard, /brand-mark/);
  assert.match(analytics, /stat-number/);
  assert.match(date, /timeZone: UTC/);
  assert.doesNotMatch(
    `${theme}\n${styles}`,
    /linear-gradient|#6200EE|#BB86FC/i,
  );
});
