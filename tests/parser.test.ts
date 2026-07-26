import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createWinstonParser } from '../src/infra/winston-parser.js';
import { groupEntries } from '../src/infra/fingerprint.js';

const parser = createWinstonParser();
const expected = new Map([
  ['2026-04-23.log', 449],
  ['2026-05-04.log', 257],
  ['2026-05-16.log', 110],
  ['2026-05-19.log', 25],
  ['2026-05-20.log', 52],
]);

const all = [];
for (const [file, count] of expected) {
  const entries = await parser.parseFile(join('fixtures/logs', file));
  assert.equal(entries.length, count, file);
  all.push(...entries);
}

const groups = groupEntries(all);
assert.equal(all.length, 893);
assert.equal(groups.length, 10);
assert.equal(groups.reduce((sum, group) => sum + group.occurrences, 0), 893);
assert.equal(groups[0]?.occurrences, 661);
assert.equal(groups[0]?.message, "Cannot read properties of undefined (reading 'access_token')");
assert.equal(all[0]?.timestamp.startsWith('2026-'), true);
console.log('parser assertions passed');
