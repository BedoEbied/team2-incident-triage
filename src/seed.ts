import { basename, join } from 'node:path';
import assert from 'node:assert/strict';
import type { Analyzer, IncidentRepo, LogParser } from './domain/ports.js';
import { groupEntries } from './infra/fingerprint.js';

const expected: [string, number][] = [
  ['2026-04-23.log', 449],
  ['2026-05-04.log', 257],
  ['2026-05-16.log', 110],
  ['2026-05-19.log', 25],
  ['2026-05-20.log', 52],
];

export async function seed(repo: IncidentRepo, parser: LogParser, analyzer: Analyzer): Promise<void> {
  await repo.seedUser('oncall@demo.io', 'demo1234', 'On-Call Engineer');
  const all = [];
  for (const [file, count] of expected) {
    const entries = await parser.parseFile(join('fixtures/logs', file));
    assert.equal(entries.length, count, file);
    all.push(...entries);
  }
  const groups = groupEntries(all);
  assert.equal(all.length, 893);
  assert.equal(groups.length, 10);
  assert.equal(groups[0]?.occurrences, 661);
  assert.equal(groups.reduce((sum, group) => sum + group.occurrences, 0), 893);
  assert.equal(all[0]!.timestamp.slice(0, 10), '2026-04-23');
  assert.equal([...all].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1)!.timestamp.slice(0, 10), '2026-05-20');
  await repo.ingest(basename('seed.log'), groups, analyzer);
  console.log(`Seeded ${all.length} entries, ${groups.length} incidents, largest incident ${groups[0]!.occurrences}`);
}
