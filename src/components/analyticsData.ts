import type { Stats } from '../api/types';

export function buildTopIncidentChartData(
  incidents: Stats['topIncidents'],
  colors: string[],
) {
  return incidents.map((incident, index) => ({
    id: incident.id,
    title: incident.title.replace('Schema drift: ', ''),
    occurrences: incident.occurrences,
    color: colors[index % colors.length],
  }));
}
