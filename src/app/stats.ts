import type { IncidentRepo } from '../domain/ports.js';

export function createStatsApp(repo: IncidentRepo) {
  return { stats: () => repo.stats() };
}
