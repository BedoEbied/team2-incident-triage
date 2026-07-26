import type { Analyzer, IncidentRepo, LogParser } from '../domain/ports.js';
import { groupEntries } from '../infra/fingerprint.js';

export function createIngestApp(parser: LogParser, analyzer: Analyzer, repo: IncidentRepo) {
  return {
    async ingestFile(path: string, fileName: string) {
      const entries = await parser.parseFile(path);
      if (entries.length === 0) return { ok: false as const, parsed: 0, grouped: 0 };
      const groups = groupEntries(entries);
      await repo.ingest(fileName, groups, analyzer);
      return { ok: true as const, parsed: entries.length, grouped: groups.length };
    },
    async groupOnly(path: string) {
      const entries = await parser.parseFile(path);
      return { entries, groups: groupEntries(entries) };
    },
  };
}
