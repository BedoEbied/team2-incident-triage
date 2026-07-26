import mock from '../../contract/mock.json';
import type {
  Activity,
  Incident,
  IncidentDetail,
  IncidentListResponse,
  IncidentQuery,
  SortField,
  Status,
  Stats,
  UploadJob,
} from './types';
import { SEVERITY_RANK } from './types';
import {
  fallbackApiError,
  HttpError,
  parseApiError,
} from './errors';
import {
  buildIncidentQueryString,
  matchesIncidentQuery,
} from './incidentQuery';

export const API_BASE = 'http://localhost:4000/api';
export const USE_MOCK = true;

const TOKEN = mock.token;
const STATUS_KEY = 'triage-web.mock.statuses';
const NOTES_KEY = 'triage-web.mock.notes';
const JOB_KEY = 'triage-web.mock.jobs';

const mockIncidentsSource = mock.incidents as Incident[];
const mockEntriesByIncident = mock.entriesByIncident as Record<string, IncidentDetail['entries']>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function withMockState(incident: Incident): Incident {
  const statuses = readJson<Record<string, Status>>(STATUS_KEY, {});
  return { ...incident, status: statuses[incident.id] ?? incident.status };
}

function compareBy(sort: SortField, order: 'asc' | 'desc') {
  const direction = order === 'asc' ? 1 : -1;
  return (a: Incident, b: Incident) => {
    let result = 0;
    if (sort === 'severity') {
      result = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    } else if (sort === 'occurrences') {
      result = a.occurrences - b.occurrences;
    } else {
      result = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
    }
    return result * direction;
  };
}

function mockIncidents(query: IncidentQuery = {}): IncidentListResponse {
  const sort = query.sort ?? 'severity';
  const order = query.order ?? 'desc';

  const items = mockIncidentsSource
    .map((incident) => withMockState(incident))
    .filter((incident) => matchesIncidentQuery(incident, query))
    .sort(compareBy(sort, order));

  return { items, total: items.length };
}

function mockDetail(id: string): IncidentDetail {
  const incident = mockIncidents().items.find((item) => item.id === id);
  if (!incident) {
    throw new HttpError(404, { code: 'NOT_FOUND', message: 'Incident not found' });
  }

  const notes = readJson<Record<string, Activity[]>>(NOTES_KEY, {});
  return {
    ...incident,
    entries: mockEntriesByIncident[id] ?? [],
    history: notes[id] ?? [],
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw new HttpError(
      response.status,
      parseApiError(body) ?? fallbackApiError(response.status),
    );
  }

  return (await response.json()) as T;
}

export function getIncidents(query: IncidentQuery) {
  if (USE_MOCK) return Promise.resolve(mockIncidents(query));
  return request<IncidentListResponse>(
    `/incidents${buildIncidentQueryString(query)}`,
  );
}

export function getIncident(id: string) {
  if (USE_MOCK) return Promise.resolve(mockDetail(id));
  return request<IncidentDetail>(`/incidents/${id}`);
}

export function getStats() {
  if (USE_MOCK) return Promise.resolve(mock.stats as Stats);
  return request<Stats>('/stats');
}

export function patchIncident(id: string, body: { status?: Status }) {
  if (USE_MOCK) {
    if (body.status) {
      const statuses = readJson<Record<string, Status>>(STATUS_KEY, {});
      writeJson(STATUS_KEY, { ...statuses, [id]: body.status });
    }
    const updated = mockIncidents().items.find((item) => item.id === id);
    if (!updated) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Incident not found' });
    return Promise.resolve(updated);
  }

  return request<Incident>(`/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function addNote(id: string, body: string) {
  if (USE_MOCK) {
    const notes = readJson<Record<string, Activity[]>>(NOTES_KEY, {});
    const activity: Activity = {
      id: `note_${Date.now()}`,
      incidentId: id,
      at: new Date().toISOString(),
      actor: mock.user.name,
      type: 'note',
      body,
    };
    writeJson(NOTES_KEY, { ...notes, [id]: [...(notes[id] ?? []), activity] });
    return Promise.resolve(activity);
  }

  return request<Activity>(`/incidents/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function uploadFiles(files: File[]) {
  if (USE_MOCK) {
    const supported = files.some((file) => /\.(log|txt|json)$/i.test(file.name));
    if (!supported) {
      throw new HttpError(400, {
        code: 'UNSUPPORTED_LOG_FORMAT',
        message: 'No parseable log blocks were found. Upload .log, .txt, or .json files.',
      });
    }

    const jobId = `job_${Date.now()}`;
    const jobs = readJson<Record<string, UploadJob>>(JOB_KEY, {});
    writeJson(JOB_KEY, {
      ...jobs,
      [jobId]: { jobId, status: 'queued', progress: 8, parsed: 0, grouped: 0, error: null },
    });
    return Promise.resolve({ jobId });
  }

  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return request<{ jobId: string }>('/uploads', { method: 'POST', body: form });
}

export function getUploadJob(jobId: string) {
  if (USE_MOCK) {
    const jobs = readJson<Record<string, UploadJob>>(JOB_KEY, {});
    const job = jobs[jobId];
    if (!job) throw new HttpError(404, { code: 'NOT_FOUND', message: 'Upload job not found' });
    const nextProgress = Math.min(100, job.progress + 28);
    const next: UploadJob = {
      ...job,
      progress: nextProgress,
      status: nextProgress >= 100 ? 'done' : nextProgress >= 64 ? 'analyzing' : 'parsing',
      parsed: Math.round((nextProgress / 100) * 893),
      grouped: nextProgress >= 100 ? 10 : Math.round((nextProgress / 100) * 10),
    };
    writeJson(JOB_KEY, { ...jobs, [jobId]: next });
    return Promise.resolve(next);
  }

  return request<UploadJob>(`/uploads/${jobId}`);
}
