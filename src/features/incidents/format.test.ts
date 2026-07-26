import assert from 'node:assert/strict';
import test from 'node:test';
import * as formatters from './format';

test('formats the source timestamp identically in UTC and Africa/Cairo', () => {
  const formatter: unknown = Reflect.get(formatters, 'formatUtcDateTime');

  assert.equal(typeof formatter, 'function');
  if (typeof formatter !== 'function') {
    return;
  }

  const previousTimeZone = process.env.TZ;

  try {
    process.env.TZ = 'UTC';
    const inUtc = formatter('2026-05-16T23:51:08Z', { seconds: true });

    process.env.TZ = 'Africa/Cairo';
    const inCairo = formatter('2026-05-16T23:51:08Z', { seconds: true });

    assert.equal(inCairo, inUtc);
    assert.match(inUtc, /May 16/);
    assert.match(inUtc, /11:51:08 PM/);
    assert.match(inUtc, /UTC$/);
  } finally {
    process.env.TZ = previousTimeZone;
  }
});
