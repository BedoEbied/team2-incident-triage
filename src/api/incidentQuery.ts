import type { Incident, IncidentQuery } from './types';

type FilterableIncident = Pick<
  Incident,
  'title' | 'summary' | 'severity' | 'status' | 'module' | 'lastSeen'
>;

export function matchesIncidentQuery(
  incident: FilterableIncident,
  query: IncidentQuery,
) {
  const search = query.q?.trim().toLowerCase();

  if (
    search &&
    !`${incident.title} ${incident.summary}`.toLowerCase().includes(search)
  ) {
    return false;
  }
  if (query.severity?.length && !query.severity.includes(incident.severity)) {
    return false;
  }
  if (query.status?.length && !query.status.includes(incident.status)) {
    return false;
  }
  if (query.module && incident.module !== query.module) {
    return false;
  }

  const lastSeenDate = new Date(incident.lastSeen).toISOString().slice(0, 10);
  if (query.from && lastSeenDate < query.from) {
    return false;
  }
  if (query.to && lastSeenDate > query.to) {
    return false;
  }

  return true;
}

export function buildIncidentQueryString(query: IncidentQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.severity?.length) params.set('severity', query.severity.join(','));
  if (query.status?.length) params.set('status', query.status.join(','));
  if (query.module) params.set('module', query.module);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);

  const value = params.toString();
  return value ? `?${value}` : '';
}
