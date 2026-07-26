import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import express from 'express';
import { createAuthApp } from '../src/app/auth.js';
import { createIncidentsApp } from '../src/app/incidents.js';
import { createIngestApp } from '../src/app/ingest.js';
import { createListApp } from '../src/app/list.js';
import { createStatsApp } from '../src/app/stats.js';
import { errorHandler } from '../src/http/errors.js';
import { registerRoutes } from '../src/http/routes.js';
import { groupEntries } from '../src/infra/fingerprint.js';
import { createRuleAnalyzer } from '../src/infra/rule-analyzer.js';
import { createSqliteRepo } from '../src/infra/sqlite.js';
import { createWinstonParser } from '../src/infra/winston-parser.js';

const fixtureFiles = [
  '2026-04-23.log',
  '2026-05-04.log',
  '2026-05-16.log',
  '2026-05-19.log',
  '2026-05-20.log',
];

function authHeaders(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

test('serves every endpoint, filter, and frozen response contract', async () => {
  const db = new Database(':memory:');
  const repo = createSqliteRepo(db);
  repo.init();
  const user = await repo.seedUser('oncall@demo.io', 'demo1234', 'On-Call Engineer');
  const parser = createWinstonParser();
  const analyzer = createRuleAnalyzer();
  const all = [];
  for (const file of fixtureFiles) {
    all.push(...await parser.parseFile(join('fixtures/logs', file)));
  }
  await repo.ingest('seed.log', groupEntries(all), analyzer);

  const jwtSecret = 'api-contract-test-secret';
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

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const protectedRequests: [string, RequestInit?][] = [
      ['/auth/me'],
      ['/uploads/missing'],
      ['/incidents'],
      ['/incidents/missing'],
      ['/incidents/missing', { method: 'PATCH' }],
      ['/incidents/missing/notes', { method: 'POST' }],
      ['/stats'],
      ['/uploads', { method: 'POST' }],
    ];
    for (const [path, init] of protectedRequests) {
      const response = await fetch(`${base}${path}`, init);
      assert.equal(response.status, 401, `${init?.method ?? 'GET'} ${path}`);
      assert.deepEqual(await response.json(), {
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      });
    }

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'oncall@demo.io', password: 'demo1234' }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json() as { token: string; user: Record<string, unknown> };
    assert.equal(typeof loginBody.token, 'string');
    assert.deepEqual(loginBody.user, user);
    assert.equal('passwordHash' in loginBody.user, false);

    const headers = authHeaders(loginBody.token);
    const me = await fetch(`${base}/auth/me`, { headers });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), user);

    const listResponse = await fetch(`${base}/incidents?sort=occurrences&order=desc`, { headers });
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as { items: Record<string, unknown>[]; total: number };
    assert.equal(list.total, 10);
    assert.equal(list.items.length, 10);
    assert.equal(list.items[0]!.occurrences, 661);
    assert.deepEqual(Object.keys(list.items[0]!).sort(), [
      'acknowledged',
      'assignee',
      'code',
      'confidence',
      'fingerprint',
      'firstSeen',
      'id',
      'lastSeen',
      'module',
      'modules',
      'occurrences',
      'remediation',
      'rootCause',
      'severity',
      'similarity',
      'status',
      'summary',
      'title',
    ]);
    assert.match(String(list.items[0]!.firstSeen), /Z$/);
    assert.match(String(list.items[0]!.lastSeen), /Z$/);

    const query = await fetch(`${base}/incidents?q=auth%20token`, { headers });
    const queried = await query.json() as { items: Record<string, unknown>[] };
    assert.equal(queried.items.length, 1);
    assert.match(String(queried.items[0]!.title), /auth token/i);

    const critical = await fetch(`${base}/incidents?severity=Critical`, { headers });
    const criticalItems = (await critical.json() as { items: Record<string, unknown>[] }).items;
    assert.equal(criticalItems.length, 1);
    assert.ok(criticalItems.every((item) => item.severity === 'Critical'));

    const statuses = await fetch(`${base}/incidents?status=New`, { headers });
    const statusItems = (await statuses.json() as { items: Record<string, unknown>[] }).items;
    assert.equal(statusItems.length, 10);
    assert.ok(statusItems.every((item) => item.status === 'New'));

    const moduleName = String(list.items[0]!.module);
    const modules = await fetch(`${base}/incidents?module=${encodeURIComponent(moduleName)}`, { headers });
    const moduleItems = (await modules.json() as { items: Record<string, unknown>[] }).items;
    assert.ok(moduleItems.length > 0);
    assert.ok(moduleItems.every((item) => item.module === moduleName));

    const from = await fetch(`${base}/incidents?from=2026-05-20`, { headers });
    const fromItems = (await from.json() as { items: Record<string, unknown>[] }).items;
    assert.ok(fromItems.length > 0);
    assert.ok(fromItems.every((item) => String(item.lastSeen).slice(0, 10) >= '2026-05-20'));

    const to = await fetch(`${base}/incidents?to=2026-04-23`, { headers });
    const toItems = (await to.json() as { items: Record<string, unknown>[] }).items;
    assert.ok(toItems.length > 0);
    assert.ok(toItems.every((item) => String(item.lastSeen).slice(0, 10) <= '2026-04-23'));

    const ascending = await fetch(`${base}/incidents?sort=occurrences&order=asc`, { headers });
    const ascendingItems = (await ascending.json() as { items: Record<string, unknown>[] }).items;
    for (let index = 1; index < ascendingItems.length; index += 1) {
      assert.ok(Number(ascendingItems[index - 1]!.occurrences) <= Number(ascendingItems[index]!.occurrences));
    }

    const incidentId = String(list.items[0]!.id);
    const patch = await fetch(`${base}/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Investigating' }),
    });
    assert.equal(patch.status, 200);

    const note = await fetch(`${base}/incidents/${incidentId}/notes`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'contract note' }),
    });
    assert.equal(note.status, 200);

    const detailResponse = await fetch(`${base}/incidents/${incidentId}`, { headers });
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as {
      entries: Record<string, unknown>[];
      history: Record<string, unknown>[];
    };
    assert.ok(detail.entries.length > 0);
    assert.equal(detail.entries.every((entry) => String(entry.timestamp).endsWith('Z')), true);
    assert.equal(detail.history.length, 2);
    for (const activity of detail.history) {
      for (const [key, value] of Object.entries(activity)) {
        assert.notEqual(value, null, `activity.${key} must be omitted instead of null`);
      }
    }

    const statsResponse = await fetch(`${base}/stats`, { headers });
    assert.equal(statsResponse.status, 200);
    const stats = await statsResponse.json() as {
      total: number;
      bySeverity: Record<string, number>;
      byStatus: Record<string, number>;
      topIncidents: Record<string, unknown>[];
      trend: { date: string; count: number }[];
    };
    assert.equal(stats.total, 10);
    assert.equal(Object.values(stats.bySeverity).reduce((sum, count) => sum + count, 0), stats.total);
    assert.equal(Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0), stats.total);
    assert.equal(stats.topIncidents.length, 5);
    assert.equal(stats.trend.reduce((sum, point) => sum + point.count, 0), 893);
    assert.ok(stats.trend.every(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date)));

    for (const path of ['/incidents/missing', '/uploads/missing']) {
      const response = await fetch(`${base}${path}`, { headers });
      assert.equal(response.status, 404);
      assert.equal((await response.json() as { error: { code: string } }).error.code, 'NOT_FOUND');
    }
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    db.close();
  }
});
