import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { createIngestApp } from '../src/app/ingest.js';
import type { LogParser, ParsedLogEntry } from '../src/domain/ports.js';
import { groupEntries } from '../src/infra/fingerprint.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

function entry(timestamp: string, message = 'repeatable upload failure'): ParsedLogEntry {
  return {
    timestamp,
    level: 'error',
    message,
    code: 'TEST',
    module: 'src/test.ts',
    symbol: 'test',
    stack: '',
  };
}

type HardenedIngest = ReturnType<typeof createIngestApp> & {
  ingestFiles?: (
    jobId: string,
    files: { path: string; fileName: string }[],
  ) => Promise<{ parsed: number; grouped: number }>;
};

test('parser exposes a streaming path and rejects malformed blocks', async () => {
  const parser = createWinstonParser() as ReturnType<typeof createWinstonParser> & {
    streamFile?: (path: string) => AsyncIterable<ParsedLogEntry>;
  };
  assert.equal(typeof parser.streamFile, 'function');

  let streamed = 0;
  for await (const parsed of parser.streamFile!(join('fixtures/logs', '2026-05-19.log'))) {
    streamed += 1;
    assert.match(parsed.timestamp, /Z$/);
  }
  assert.equal(streamed, 25);

  const directory = await mkdtemp(join(tmpdir(), 'triage-parser-'));
  const malformed = join(directory, 'malformed.log');
  try {
    await writeFile(malformed, "{\n  level: 'error',\n}\n", 'utf8');
    await assert.rejects(parser.parseFile(malformed), /parseable log block/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('initializes SQLite staging tables for untrusted entries', () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'staging_%' ORDER BY name")
      .all() as { name: string }[];
    assert.deepEqual(tables.map(({ name }) => name), ['staging_entry', 'staging_file']);
  } finally {
    db.close();
  }
});

test('recomputes aggregates across repeat and multi-file ingestion', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    const analyzer = createRuleAnalyzer();
    repo.init();

    await repo.ingest('first.log', groupEntries([entry('2026-05-01T00:00:00.000Z')]), analyzer);
    await repo.ingest('second.log', groupEntries([entry('2026-05-02T00:00:00.000Z')]), analyzer);
    let incidents = await repo.list({});
    assert.equal(incidents.items.length, 1);
    assert.equal(incidents.items[0]!.occurrences, 2);
    assert.equal(incidents.items[0]!.firstSeen, '2026-05-01T00:00:00.000Z');
    assert.equal(incidents.items[0]!.lastSeen, '2026-05-02T00:00:00.000Z');

    await repo.ingest('first.log', groupEntries([entry('2026-05-01T00:00:00.000Z')]), analyzer);
    incidents = await repo.list({});
    assert.equal(incidents.items.length, 1);
    assert.equal(incidents.items[0]!.occurrences, 2);
    assert.equal((await repo.stats()).trend.reduce((sum, point) => sum + point.count, 0), 2);
  } finally {
    db.close();
  }
});

test('streams all files through staging and commits them atomically', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    const parser: LogParser = {
      async parseFile() {
        throw Reflect.construct(Error, ['buffered parser path must not be used']) as Error;
      },
      async *streamFile(path) {
        yield entry(path.includes('first') ? '2026-05-01T00:00:00.000Z' : '2026-05-02T00:00:00.000Z');
      },
    } as LogParser;
    const ingest = createIngestApp(parser, createRuleAnalyzer(), repo) as HardenedIngest;
    assert.equal(typeof ingest.ingestFiles, 'function');

    const files = [
      { path: 'first.tmp', fileName: 'first.log' },
      { path: 'second.tmp', fileName: 'second.log' },
    ];
    assert.deepEqual(await ingest.ingestFiles!('job-1', files), { parsed: 2, grouped: 1 });
    assert.equal((await repo.list({})).items[0]!.occurrences, 2);
    assert.deepEqual(await ingest.ingestFiles!('job-2', files), { parsed: 2, grouped: 1 });
    assert.equal((await repo.list({})).items[0]!.occurrences, 2);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_entry').get() as { count: number }).count, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_file').get() as { count: number }).count, 0);
  } finally {
    db.close();
  }
});

test('cleans staging and leaves live incidents unchanged after a parser failure', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    const parser = {
      async parseFile() {
        return [];
      },
      async *streamFile() {
        yield entry('2026-05-01T00:00:00.000Z');
        throw Object.assign(Reflect.construct(Error, ['malformed or unparseable log block']) as Error, {
          apiCode: 'UNSUPPORTED_LOG_FORMAT',
          httpStatus: 400,
          publicMessage: 'Uploaded file contains a malformed or unparseable log block',
        });
      },
    } as LogParser;
    const ingest = createIngestApp(parser, createRuleAnalyzer(), repo) as HardenedIngest;
    assert.equal(typeof ingest.ingestFiles, 'function');

    await assert.rejects(
      ingest.ingestFiles!('failed-job', [{ path: 'broken.tmp', fileName: 'broken.log' }]),
      /malformed or unparseable/,
    );
    assert.equal((await repo.list({})).total, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_entry').get() as { count: number }).count, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_file').get() as { count: number }).count, 0);
  } finally {
    db.close();
  }
});

test('rejects requests above 10,000 parsed entries before live data changes', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    const parser = {
      async parseFile() {
        return [];
      },
      async *streamFile() {
        for (let index = 0; index < 10_001; index += 1) {
          yield entry('2026-05-01T00:00:00.000Z', `bounded entry ${index}`);
        }
      },
    } as LogParser;
    const ingest = createIngestApp(parser, createRuleAnalyzer(), repo) as HardenedIngest;
    assert.equal(typeof ingest.ingestFiles, 'function');

    await assert.rejects(
      ingest.ingestFiles!('oversized-job', [{ path: 'large.tmp', fileName: 'large.log' }]),
      /at most 10,000 log entries/,
    );
    assert.equal((await repo.list({})).total, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_entry').get() as { count: number }).count, 0);
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_file').get() as { count: number }).count, 0);
  } finally {
    db.close();
  }
});
