import mock from '../../contract/mock.json';
import {
  type Activity,
  type ApiError,
  type Incident,
  type IncidentDetail,
  type IncidentListResponse,
  type IncidentQuery,
  type LogEntry,
  type Stats,
  type Status,
  type User
} from './types';
import { applyIncidentQuery } from '@/features/incidents/query';

export { applyIncidentQuery } from '@/features/incidents/query';

// Phones and simulators cannot reach the host machine's localhost; replace with this machine's LAN IP when USE_MOCK is false.
export const API_BASE = 'http://172.20.1.228:4000/api';
export const USE_MOCK = false;

type LoginResponse = { token: string; user: User };
type ApiErrorCode = ApiError['error']['code'];
type MockShape = {
  user: User;
  token: string;
  incidents: Incident[];
  entriesByIncident: Record<string, LogEntry[]>;
  stats: Stats;
};

const fixture = mock as MockShape;
let mockIncidents: Incident[] = fixture.incidents.map((incident) => ({ ...incident }));
const mockHistory = new Map<string, Activity[]>(
  fixture.incidents.map((incident) => [
    incident.id,
    [
      {
        id: `act_seed_${incident.id}`,
        incidentId: incident.id,
        at: incident.firstSeen,
        actor: 'AI Triage',
        type: 'note',
        body: `Incident grouped from ${incident.occurrences} related log entries.`
      }
    ]
  ])
);

const API_ERROR_CODES: ReadonlySet<ApiErrorCode> = new Set([
  'UNAUTHORIZED',
  'NOT_FOUND',
  'UNSUPPORTED_LOG_FORMAT',
  'VALIDATION_ERROR',
  'INTERNAL'
]);

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;

  constructor(status: number, message: string, code?: ApiErrorCode) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createApiError(status: number, body: unknown): ApiClientError {
  if (isRecord(body) && isRecord(body.error)) {
    const message = body.error.message;
    const rawCode = body.error.code;
    const code =
      typeof rawCode === 'string' && API_ERROR_CODES.has(rawCode as ApiErrorCode)
        ? (rawCode as ApiErrorCode)
        : undefined;

    if (typeof message === 'string' && message.trim()) {
      return new ApiClientError(status, message, code);
    }
  }

  return new ApiClientError(status, `Request failed (${status})`);
}

function apiError(message: string): Error {
  return new Error(message);
}

function makeActivity(incidentId: string, type: Activity['type'], body: Partial<Activity>): Activity {
  return {
    id: `act_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    incidentId,
    at: new Date().toISOString(),
    actor: fixture.user.name,
    type,
    ...body
  };
}

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });

  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = rawBody;
    }
  }

  if (!response.ok) {
    throw createApiError(response.status, body);
  }
  if (!isRecord(body)) {
    throw new ApiClientError(response.status, 'Invalid server response');
  }
  return body as T;
}

export const apiClient = {
  async login(email: string, password: string): Promise<LoginResponse> {
    if (USE_MOCK) {
      if (email === fixture.user.email && password === 'demo1234') {
        return { token: fixture.token, user: fixture.user };
      }
      throw apiError('Invalid demo credentials');
    }

    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async me(token: string): Promise<User> {
    if (USE_MOCK) {
      return fixture.user;
    }
    return request<User>('/auth/me', undefined, token);
  },

  async listIncidents(query?: IncidentQuery, token?: string | null): Promise<IncidentListResponse> {
    if (USE_MOCK) {
      const items = applyIncidentQuery(mockIncidents, query);
      return { items, total: items.length };
    }

    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.severity?.length) params.set('severity', query.severity.join(','));
    if (query?.status?.length) params.set('status', query.status.join(','));
    if (query?.module) params.set('module', query.module);
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    if (query?.sort) params.set('sort', query.sort);
    if (query?.order) params.set('order', query.order);

    return request<IncidentListResponse>(`/incidents?${params.toString()}`, undefined, token);
  },

  async getIncident(id: string, token?: string | null): Promise<IncidentDetail> {
    if (USE_MOCK) {
      const incident = mockIncidents.find((item) => item.id === id);
      if (!incident) {
        throw apiError('Incident not found');
      }
      return {
        ...incident,
        entries: fixture.entriesByIncident[id] ?? [],
        history: mockHistory.get(id) ?? []
      };
    }

    return request<IncidentDetail>(`/incidents/${id}`, undefined, token);
  },

  async patchIncident(
    id: string,
    patch: { status?: Status; assigneeId?: string; acknowledged?: boolean },
    token?: string | null
  ): Promise<Incident> {
    if (USE_MOCK) {
      const index = mockIncidents.findIndex((item) => item.id === id);
      if (index === -1) {
        throw apiError('Incident not found');
      }

      const previous = mockIncidents[index];
      const next: Incident = {
        ...previous,
        status: patch.status ?? previous.status,
        acknowledged: patch.acknowledged ?? previous.acknowledged,
        assignee: patch.assigneeId ? { id: patch.assigneeId, name: fixture.user.name } : previous.assignee
      };
      mockIncidents[index] = next;

      const history = mockHistory.get(id) ?? [];
      if (patch.status && patch.status !== previous.status) {
        history.unshift(makeActivity(id, 'status', { from: previous.status, to: patch.status }));
      }
      if (patch.acknowledged !== undefined && patch.acknowledged !== previous.acknowledged) {
        history.unshift(makeActivity(id, 'ack', { from: String(previous.acknowledged), to: String(patch.acknowledged) }));
      }
      if (patch.assigneeId && patch.assigneeId !== previous.assignee?.id) {
        history.unshift(makeActivity(id, 'assign', { to: fixture.user.name }));
      }
      mockHistory.set(id, history);
      return next;
    }

    return request<Incident>(
      `/incidents/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
      token
    );
  },

  async addNote(id: string, body: string, token?: string | null): Promise<Activity> {
    if (USE_MOCK) {
      if (!mockIncidents.some((item) => item.id === id)) {
        throw apiError('Incident not found');
      }
      const activity = makeActivity(id, 'note', { body });
      const history = mockHistory.get(id) ?? [];
      history.unshift(activity);
      mockHistory.set(id, history);
      return activity;
    }

    return request<Activity>(
      `/incidents/${id}/notes`,
      { method: 'POST', body: JSON.stringify({ body }) },
      token
    );
  }
};
