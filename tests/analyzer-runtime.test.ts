import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Analysis } from '../src/domain/ports.js';
import {
  createFileAnalysisCache,
  mapPool,
  withTimeoutRetry,
} from '../src/infra/analyzers/shared.js';

const analysis: Analysis = {
  title: 'Database schema drift',
  summary: 'A missing column is breaking reads.',
  severity: 'High',
  rootCause: 'The migration did not run.',
  remediation: 'Apply the migration.',
  confidence: 0.92,
};

test('timeout rejects an operation that ignores abort and retries exactly once', async () => {
  let attempts = 0;
  const startedAt = Date.now();

  await assert.rejects(
    withTimeoutRetry(
      async () => {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 80));
        return 'late';
      },
      5,
      0,
    ),
    /timed out/i,
  );

  assert.equal(attempts, 2);
  assert.ok(Date.now() - startedAt < 60, 'timeout should not wait for an abort-ignoring provider');
});

test('file analysis cache survives recreation and never exposes a partial JSON write', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'triage-analysis-cache-'));
  const path = join(directory, 'cache.json');
  const first = createFileAnalysisCache(path);

  await Promise.all([
    first.set('openai:fp-1:v1', analysis),
    first.set('openai:fp-2:v1', { ...analysis, title: 'Second analysis' }),
  ]);

  const onDisk = JSON.parse(await readFile(path, 'utf8')) as Record<string, Analysis>;
  assert.equal(onDisk['openai:fp-1:v1']?.title, analysis.title);
  assert.equal(onDisk['openai:fp-2:v1']?.title, 'Second analysis');

  const second = createFileAnalysisCache(path);
  assert.deepEqual(second.get('openai:fp-1:v1'), analysis);
});

test('mapPool never runs more than four analyses concurrently', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapPool(
    Array.from({ length: 12 }, (_, index) => index),
    4,
    async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item * 2;
    },
  );

  assert.equal(peak, 4);
  assert.deepEqual(results, Array.from({ length: 12 }, (_, index) => index * 2));
});
