import { SEVERITY_RANK, type Incident, type IncidentQuery } from '@/api/types';

export function applyIncidentQuery(items: Incident[], query?: IncidentQuery): Incident[] {
  const search = query?.q?.trim().toLowerCase();
  const severities = query?.severity?.length ? new Set(query.severity) : null;
  const statuses = query?.status?.length ? new Set(query.status) : null;

  const filtered = items.filter((incident) => {
    if (
      search &&
      !`${incident.title} ${incident.summary}`.toLowerCase().includes(search)
    ) {
      return false;
    }
    if (severities && !severities.has(incident.severity)) {
      return false;
    }
    if (statuses && !statuses.has(incident.status)) {
      return false;
    }
    if (query?.module && incident.module !== query.module) {
      return false;
    }
    return true;
  });

  const sort = query?.sort ?? 'severity';
  const direction = query?.order === 'asc' ? 1 : -1;

  return filtered.sort((leftIncident, rightIncident) => {
    const left =
      sort === 'severity'
        ? SEVERITY_RANK[leftIncident.severity]
        : sort === 'occurrences'
          ? leftIncident.occurrences
          : Date.parse(leftIncident.lastSeen);
    const right =
      sort === 'severity'
        ? SEVERITY_RANK[rightIncident.severity]
        : sort === 'occurrences'
          ? rightIncident.occurrences
          : Date.parse(rightIncident.lastSeen);

    return (left - right) * direction;
  });
}
