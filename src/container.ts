import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createAuthApp } from './app/auth.js';
import { createIncidentsApp } from './app/incidents.js';
import { createIngestApp } from './app/ingest.js';
import { createListApp } from './app/list.js';
import { createStatsApp } from './app/stats.js';
import { createRuleAnalyzer } from './infra/rule-analyzer.js';
import { createSqliteRepo } from './infra/sqlite.js';
import { createWinstonParser } from './infra/winston-parser.js';

export function createContainer() {
  prepareUploadDirectory('data/uploads');
  const db = new Database('data/triage.db');
  const repo = createSqliteRepo(db);
  const parser = createWinstonParser();
  const analyzer = createRuleAnalyzer();
  const jwtSecret = resolveJwtSecret(process.env);
  return {
    repo,
    parser,
    analyzer,
    jwtSecret,
    auth: createAuthApp(repo, jwtSecret),
    ingest: createIngestApp(parser, analyzer, repo),
    list: createListApp(repo),
    stats: createStatsApp(repo),
    incidents: createIncidentsApp(repo),
  };
}

export function resolveJwtSecret(env: NodeJS.ProcessEnv): string {
  const configured = env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') {
    throw Reflect.construct(Error, ['JWT_SECRET is required in production']) as Error;
  }
  return 'dev-triage-secret';
}

export function prepareUploadDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isFile()) unlinkSync(join(path, entry.name));
  }
}
