import type { IncidentRepo } from '../domain/ports.js';
import type { IncidentQuery } from '../domain/types.js';

export function createListApp(repo: IncidentRepo) {
  return { list: (query: IncidentQuery) => repo.list(query), detail: (id: string) => repo.detail(id) };
}
