import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatUtcDateLabel,
  formatUtcTimestamp,
  toUtcDateKey,
} from './date.ts';

test('formats incident timestamps in UTC', () => {
  assert.equal(
    formatUtcTimestamp('2026-05-16T23:51:08Z'),
    'May 16, 11:51 PM UTC',
  );
});

test('formats trend buckets as UTC calendar dates', () => {
  assert.equal(formatUtcDateLabel('2026-05-16'), 'May 16');
});

test('derives filter keys from the UTC date', () => {
  assert.equal(toUtcDateKey('2026-05-16T23:51:08Z'), '2026-05-16');
  assert.equal(toUtcDateKey('2026-05-16'), '2026-05-16');
});
