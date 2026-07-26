import type { Analyzer, IncidentRepo, LogParser } from '../domain/ports.js';
import { groupEntries } from '../infra/fingerprint.js';
import { createPublicError } from '../domain/errors.js';

const MAX_ENTRIES_PER_REQUEST = 10_000;

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
    async ingestFiles(jobId: string, files: { path: string; fileName: string }[]) {
      await repo.beginStaging(
        jobId,
        files.map(({ fileName }, fileIndex) => ({ fileIndex, fileName })),
      );
      let parsed = 0;
      try {
        for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
          const file = files[fileIndex]!;
          for await (const entry of parser.streamFile(file.path)) {
            parsed += 1;
            if (parsed > MAX_ENTRIES_PER_REQUEST) {
              throw createPublicError(
                'VALIDATION_ERROR',
                'An upload request may contain at most 10,000 log entries',
              );
            }
            await repo.stageEntry(jobId, fileIndex, entry);
          }
        }
        return await repo.commitStaged(jobId, analyzer);
      } finally {
        await repo.clearStaging(jobId);
      }
    },
  };
}
