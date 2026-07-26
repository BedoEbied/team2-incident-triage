import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { seed } from '../src/seed.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

test('refreshes the trusted seed idempotently and prints every golden invariant', async () => {
  const db = new Database(':memory:');
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => output.push(values.map(String).join(' '));
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    const parser = createWinstonParser();
    const analyzer = createRuleAnalyzer();

    await seed(repo, parser, analyzer);
    await seed(repo, parser, analyzer);

    assert.deepEqual(output, [
      'Seeded 893 entries, 10 incidents, largest incident 661',
      'Seeded 893 entries, 10 incidents, largest incident 661',
    ]);
    const incidents = await repo.list({ sort: 'occurrences', order: 'desc' });
    assert.equal(incidents.total, 10);
    assert.equal(incidents.items.reduce((sum, item) => sum + item.occurrences, 0), 893);
    assert.equal(incidents.items[0]!.occurrences, 661);
  } finally {
    console.log = originalLog;
    db.close();
  }
});
