import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { groupEntries } from '../src/infra/fingerprint.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

const expected = new Map([
  ['2026-04-23.log', 449],
  ['2026-05-04.log', 257],
  ['2026-05-16.log', 110],
  ['2026-05-19.log', 25],
  ['2026-05-20.log', 52],
]);

test('emits exactly one UTC entry for every block in each fixture', async () => {
  const parser = createWinstonParser();

  for (const [file, count] of expected) {
    const path = join('fixtures/logs', file);
    const source = await readFile(path, 'utf8');
    const blockCount = source.split(/\r?\n/).filter((line) => line === '{').length;
    const entries = await parser.parseFile(path);

    assert.equal(blockCount, count, `${file} block count`);
    assert.equal(entries.length, blockCount, `${file} emitted entries`);
    for (const entry of entries) {
      assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `${file} UTC timestamp`);
      assert.equal(Number.isNaN(Date.parse(entry.timestamp)), false, `${file} valid timestamp`);
    }
  }
});

test('preserves corpus grouping invariants', async () => {
  const parser = createWinstonParser();
  const all = [];
  for (const file of expected.keys()) all.push(...await parser.parseFile(join('fixtures/logs', file)));

  const groups = groupEntries(all);
  assert.equal(all.length, 893);
  assert.equal(groups.length, 10);
  assert.equal(groups.reduce((sum, group) => sum + group.occurrences, 0), 893);
  assert.equal(groups[0]?.occurrences, 661);
  assert.equal(groups[0]?.message, "Cannot read properties of undefined (reading 'access_token')");
});

test('analyzes connect and read ETIMEDOUT failures differently', async () => {
  const parser = createWinstonParser();
  const analyzer = createRuleAnalyzer();
  const entries = await parser.parseFile(join('fixtures/logs', '2026-05-04.log'));
  const timeoutGroups = groupEntries(entries).filter((group) => group.normalizedMessage.includes('ETIMEDOUT'));
  const connect = timeoutGroups.find((group) => group.normalizedMessage.includes('connect ETIMEDOUT'));
  const read = timeoutGroups.find((group) => group.normalizedMessage.includes('read ETIMEDOUT'));

  assert.ok(connect);
  assert.ok(read);
  const connectAnalysis = analyzer.analyze(connect);
  const readAnalysis = analyzer.analyze(read);
  assert.notEqual(connectAnalysis.title, readAnalysis.title);
  assert.notEqual(connectAnalysis.rootCause, readAnalysis.rootCause);
  assert.notEqual(connectAnalysis.remediation, readAnalysis.remediation);
  assert.match(connectAnalysis.title, /connect/i);
  assert.match(readAnalysis.title, /read/i);
});

test('buckets stats trend dates in UTC', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    const analyzer = createRuleAnalyzer();
    repo.init();
    const entries = [{
      timestamp: '2026-05-01T23:30:00-02:00',
      level: 'error',
      message: 'UTC boundary regression',
      code: null,
      module: 'src/test.ts',
      symbol: 'test',
      stack: '',
    }];
    await repo.ingest('utc.log', groupEntries(entries), analyzer);

    const stats = await repo.stats();
    assert.deepEqual(stats.trend, [{ date: '2026-05-02', count: 1 }]);
    assert.match(stats.trend[0]!.date, /^\d{4}-\d{2}-\d{2}$/);
  } finally {
    db.close();
  }
});
