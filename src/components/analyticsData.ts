import type { Stats } from '../api/types';

export function buildTopIncidentChartData(
  incidents: Stats['topIncidents'],
) {
  return incidents.map((incident) => ({
    id: incident.id,
    title: incident.title.replace('Schema drift: ', ''),
    occurrences: incident.occurrences,
  }));
}
