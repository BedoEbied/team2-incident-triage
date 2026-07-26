const INCIDENT_PATH = /^\/incident\/[^/?#]+$/;

export function incidentPath(id: string): string {
  return `/incident/${encodeURIComponent(id)}`;
}

export function notificationIncidentPath(value: unknown): string | null {
  return typeof value === 'string' && INCIDENT_PATH.test(value) ? value : null;
}

export function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
