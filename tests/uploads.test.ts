import assert from 'node:assert/strict';
import { access, mkdir, readdir } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { basename } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import express from 'express';
import { createAuthApp } from '../src/app/auth.js';
import { createIncidentsApp } from '../src/app/incidents.js';
import { createIngestApp } from '../src/app/ingest.js';
import { createListApp } from '../src/app/list.js';
import { createStatsApp } from '../src/app/stats.js';
import type { LogParser } from '../src/domain/ports.js';
import { errorHandler } from '../src/http/errors.js';
import { registerRoutes } from '../src/http/routes.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

const validBlock = `{
  message: 'uploaded integration failure',
  level: 'error',
  timestamp: '2026-05-21 10:00:00'
}
`;

function formWithFiles(count: number, contents = validBlock): FormData {
  const form = new FormData();
  for (let index = 0; index < count; index += 1) {
    form.append('files', new Blob([contents]), `client-${index}.log`);
  }
  return form;
}

test('upload endpoint enforces limits, stages atomically, and cleans temporary files', async () => {
  await mkdir('data/uploads', { recursive: true });
  const db = new Database(':memory:');
  const repo = createSqliteRepo(db);
  repo.init();
  await repo.seedUser('oncall@demo.io', 'demo1234', 'On-Call Engineer');
  const analyzer = createRuleAnalyzer();
  const winston = createWinstonParser();
  const parsedPaths: string[] = [];
  const parser: LogParser = {
    parseFile: (path) => winston.parseFile(path),
    async *streamFile(path) {
      parsedPaths.push(path);
      yield* winston.streamFile(path);
    },
  } as LogParser;
  const jwtSecret = 'upload-test-secret';
  const app = express();
  app.use(express.json());
  registerRoutes(app, {
    repo,
    auth: createAuthApp(repo, jwtSecret),
    ingest: createIngestApp(parser, analyzer, repo),
    list: createListApp(repo),
    stats: createStatsApp(repo),
    incidents: createIncidentsApp(repo),
    jwtSecret,
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}/api`;
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'oncall@demo.io', password: 'demo1234' }),
    });
    assert.equal(login.status, 200);
    const token = (await login.json() as { token: string }).token;
    const authorization = { authorization: `Bearer ${token}` };

    const upload = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: authorization,
      body: formWithFiles(1),
    });
    assert.equal(upload.status, 200);
    const { jobId } = await upload.json() as { jobId: string };
    assert.equal((await repo.getJob(jobId))?.status, 'done');
    assert.equal((await repo.list({})).items[0]!.occurrences, 1);
    assert.equal(parsedPaths.length, 1);
    assert.notEqual(basename(parsedPaths[0]!), 'client-0.log');
    await assert.rejects(access(parsedPaths[0]!));

    const repeat = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: authorization,
      body: formWithFiles(1),
    });
    assert.equal(repeat.status, 200);
    assert.equal((await repo.list({})).items[0]!.occurrences, 1);

    const beforeRejected = await readdir('data/uploads');
    const tooMany = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: authorization,
      body: formWithFiles(6),
    });
    assert.equal(tooMany.status, 400);
    assert.deepEqual(await tooMany.json(), {
      error: { code: 'VALIDATION_ERROR', message: 'At most 5 files may be uploaded at once' },
    });

    const tooLarge = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: authorization,
      body: formWithFiles(1, 'x'.repeat(10 * 1024 * 1024 + 1)),
    });
    assert.equal(tooLarge.status, 400);
    assert.deepEqual(await tooLarge.json(), {
      error: { code: 'VALIDATION_ERROR', message: 'Each file must be at most 10 MiB' },
    });
    assert.deepEqual(await readdir('data/uploads'), beforeRejected);

    const malformed = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: authorization,
      body: formWithFiles(1, "{\n  level: 'error',\n}\n"),
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: {
        code: 'UNSUPPORTED_LOG_FORMAT',
        message: 'Uploaded file contains a malformed or unparseable log block',
      },
    });
    const failed = db.prepare(
      "SELECT status, error FROM upload_job WHERE status = 'failed' ORDER BY rowid DESC LIMIT 1",
    ).get() as { status: string; error: string };
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'Uploaded file contains a malformed or unparseable log block');
    assert.equal((db.prepare('SELECT COUNT(*) as count FROM staging_entry').get() as { count: number }).count, 0);
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    db.close();
  }
});
