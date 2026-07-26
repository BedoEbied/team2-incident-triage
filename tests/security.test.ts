import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import express from 'express';
import * as authModule from '../src/app/auth.js';
import { createIncidentsApp } from '../src/app/incidents.js';
import { createIngestApp } from '../src/app/ingest.js';
import { createListApp } from '../src/app/list.js';
import { createStatsApp } from '../src/app/stats.js';
import * as containerModule from '../src/container.js';
import type { IncidentRepo } from '../src/domain/ports.js';
import { errorHandler } from '../src/http/errors.js';
import { registerRoutes } from '../src/http/routes.js';
import { groupEntries } from '../src/infra/fingerprint.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

type Compare = (password: string, hash: string) => Promise<boolean>;
type AuthFactory = (
  repo: IncidentRepo,
  secret: string,
  compare: Compare,
) => ReturnType<typeof authModule.createAuthApp>;

async function jsonRequest(
  url: string,
  token: string,
  method: string,
  body: unknown,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('requires JWT_SECRET in production and uses the development fallback otherwise', () => {
  const resolveJwtSecret = (containerModule as typeof containerModule & {
    resolveJwtSecret?: (env: NodeJS.ProcessEnv) => string;
  }).resolveJwtSecret;
  assert.equal(typeof resolveJwtSecret, 'function');
  assert.equal(resolveJwtSecret!({ NODE_ENV: 'development' }), 'dev-triage-secret');
  assert.equal(resolveJwtSecret!({ NODE_ENV: 'test' }), 'dev-triage-secret');
  assert.equal(resolveJwtSecret!({ NODE_ENV: 'production', JWT_SECRET: 'production-secret' }), 'production-secret');
  assert.throws(() => resolveJwtSecret!({ NODE_ENV: 'production' }), /JWT_SECRET is required in production/);
});

test('compares unknown users against one fixed cost-10 dummy hash', async () => {
  const db = new Database(':memory:');
  try {
    const repo = createSqliteRepo(db);
    repo.init();
    await repo.seedUser('known@example.com', 'secret123', 'Known User');
    const known = await repo.findUserByEmail('known@example.com');
    assert.ok(known);
    assert.equal(bcrypt.getRounds(known.passwordHash), 10);

    const calls: { password: string; hash: string }[] = [];
    const createAuth = authModule.createAuthApp as AuthFactory;
    const auth = createAuth(repo, 'test-secret', async (password, hash) => {
      calls.push({ password, hash });
      return false;
    });
    assert.equal(await auth.login('missing@example.com', 'guess'), null);
    assert.equal(calls.length, 1);

    const dummyHash = (authModule as typeof authModule & { DUMMY_PASSWORD_HASH?: string }).DUMMY_PASSWORD_HASH;
    assert.equal(typeof dummyHash, 'string');
    assert.equal(calls[0]!.hash, dummyHash);
    assert.equal(bcrypt.getRounds(dummyHash!), 10);

    calls.length = 0;
    assert.equal(await auth.login('another-missing@example.com', 'guess'), null);
    assert.equal(calls[0]!.hash, dummyHash);
  } finally {
    db.close();
  }
});

test('validates mutations, emits one activity per change, and shapes request errors', async () => {
  const db = new Database(':memory:');
  const repo = createSqliteRepo(db);
  repo.init();
  const user = await repo.seedUser('oncall@demo.io', 'demo1234', 'On-Call Engineer');
  const analyzer = createRuleAnalyzer();
  await repo.ingest('mutation.log', groupEntries([{
    timestamp: '2026-05-22T00:00:00.000Z',
    level: 'error',
    message: 'mutation test incident',
    code: null,
    module: 'src/test.ts',
    symbol: 'test',
    stack: '',
  }]), analyzer);
  const incident = (await repo.list({})).items[0]!;
  const jwtSecret = 'security-test-secret';
  const app = express();
  app.use(express.json());
  registerRoutes(app, {
    repo,
    auth: authModule.createAuthApp(repo, jwtSecret),
    ingest: createIngestApp(createWinstonParser(), analyzer, repo),
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
    const token = (await login.json() as { token: string }).token;

    const malformed = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' },
    });

    const invalidPatches: unknown[] = [
      null,
      [],
      {},
      { unexpected: true },
      { status: 'Closed' },
      { assigneeId: 42 },
      { acknowledged: 'true' },
    ];
    for (const body of invalidPatches) {
      const response = await jsonRequest(`${base}/incidents/${incident.id}`, token, 'PATCH', body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal((await response.json() as { error: { code: string } }).error.code, 'VALIDATION_ERROR');
    }

    const invalidNotes: unknown[] = [
      null,
      [],
      {},
      { body: '' },
      { body: '   ' },
      { body: 42 },
      { body: 'valid', unexpected: true },
    ];
    for (const body of invalidNotes) {
      const response = await jsonRequest(`${base}/incidents/${incident.id}/notes`, token, 'POST', body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal((await response.json() as { error: { code: string } }).error.code, 'VALIDATION_ERROR');
    }

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}`,
      token,
      'PATCH',
      { status: 'Investigating' },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 1);

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}`,
      token,
      'PATCH',
      { assigneeId: user.id },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 2);

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}`,
      token,
      'PATCH',
      { acknowledged: true },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 3);

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}/notes`,
      token,
      'POST',
      { body: '  verified note  ' },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 4);
    assert.equal((await repo.detail(incident.id))!.history[0]!.body, 'verified note');

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}`,
      token,
      'PATCH',
      { status: 'Resolved', acknowledged: false },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 6);

    assert.equal((await jsonRequest(
      `${base}/incidents/${incident.id}`,
      token,
      'PATCH',
      { status: 'Resolved' },
    )).status, 200);
    assert.equal((await repo.detail(incident.id))!.history.length, 6);

    const mutableRepo = repo as IncidentRepo & { list: IncidentRepo['list'] };
    const originalList = mutableRepo.list;
    mutableRepo.list = async () => {
      throw Reflect.construct(Error, ['sensitive database detail']) as Error;
    };
    const rejected = await fetch(`${base}/incidents`, {
      headers: { authorization: `Bearer ${token}` },
    });
    mutableRepo.list = originalList;
    assert.equal(rejected.status, 500);
    assert.deepEqual(await rejected.json(), {
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    db.close();
  }
});
