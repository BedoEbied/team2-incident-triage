import type { IncidentRepo } from '../domain/ports.js';
import type { Status } from '../domain/types.js';

export function createIncidentsApp(repo: IncidentRepo) {
  return {
    update: (id: string, patch: { status?: Status; assigneeId?: string | null; acknowledged?: boolean }, actor: string) => repo.updateIncident(id, patch, actor),
    addNote: (id: string, body: string, actor: string) => repo.addNote(id, body, actor),
  };
}
