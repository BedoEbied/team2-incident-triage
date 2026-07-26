import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true });
  return entries
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => join(directory, entry));
}

test('keeps domain independent and construction inside the composition root', async () => {
  for (const path of await sourceFiles('src/domain')) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:infra|http)\//, path);
  }

  for (const path of await sourceFiles('src')) {
    if (path === join('src', 'container.ts')) continue;
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /\bnew\s+[A-Za-z_$]/, path);
  }
});

test('keeps parser, multipart, staging, and contract boundaries explicit', async () => {
  const parser = await readFile('src/infra/winston-parser.ts', 'utf8');
  assert.doesNotMatch(parser, /\bJSON\.parse\b|\beval\s*\(/);
  assert.match(parser, /createReadStream/);
  assert.match(parser, /AsyncIterable<ParsedLogEntry>/);

  const routes = await readFile('src/http/routes.ts', 'utf8');
  assert.match(routes, /filename:\s*\([^)]*\)\s*=>\s*callback\(null,\s*randomUUID\(\)\)/);
  assert.match(routes, /files:\s*5/);
  assert.match(routes, /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(routes, /parts:\s*10/);

  const sqlite = await readFile('src/infra/sqlite.ts', 'utf8');
  assert.match(sqlite, /CREATE TABLE IF NOT EXISTS staging_entry/);
  assert.match(sqlite, /db\.transaction/);

  const domainTypes = await readFile('src/domain/types.ts', 'utf8');
  assert.equal(domainTypes.trim(), "export * from '../../contract/types.js';");
});
