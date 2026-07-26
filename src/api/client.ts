import mock from '../../contract/mock.json';
import {
  SEVERITY_RANK,
  type Activity,
  type Incident,
  type IncidentDetail,
  type IncidentListResponse,
  type IncidentQuery,
  type LogEntry,
  type Stats,
  type Status,
  type User
} from './types';

// Phones and simulators cannot reach the host machine's localhost; replace with this machine's LAN IP when USE_MOCK is false.
export const API_BASE = 'http://172.20.1.228:4000/api';
export const USE_MOCK = false;

type LoginResponse = { token: string; user: User };
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

function sortIncidents(items: Incident[], query?: IncidentQuery): Incident[] {
  const sort = query?.sort ?? 'severity';
  const order = query?.order ?? 'desc';
  const direction = order === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    const left = sort === 'severity' ? SEVERITY_RANK[a.severity] : sort === 'occurrences' ? a.occurrences : Date.parse(a.lastSeen);
    const right = sort === 'severity' ? SEVERITY_RANK[b.severity] : sort === 'occurrences' ? b.occurrences : Date.parse(b.lastSeen);
    return (left - right) * direction;
  });
}

function filterIncidents(query?: IncidentQuery): Incident[] {
  let items = [...mockIncidents];
  const q = query?.q?.trim().toLowerCase();

  if (q) {
    items = items.filter((incident) =>
      `${incident.title} ${incident.summary}`.toLowerCase().includes(q)
    );
  }
  if (query?.severity?.length) {
    items = items.filter((incident) => query.severity?.includes(incident.severity));
  }
  if (query?.status?.length) {
    items = items.filter((incident) => query.status?.includes(incident.status));
  }
  if (query?.module) {
    items = items.filter((incident) => incident.module === query.module);
  }

  return sortIncidents(items, query);
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

  const body = await response.json();
  if (!response.ok) {
    throw apiError(body?.error?.message ?? 'Request failed');
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
      const items = filterIncidents(query);
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
