import assert from 'node:assert/strict';
import test from 'node:test';
import type { Incident, IncidentQuery } from '@/api/types';
import * as clientModule from '@/api/client';

const baseIncident: Incident = {
  id: 'base',
  fingerprint: 'fingerprint',
  title: 'Gateway timeout',
  summary: 'Payment gateway retry failed',
  severity: 'Critical',
  status: 'Investigating',
  rootCause: 'Upstream request timed out',
  remediation: 'Check the upstream gateway',
  confidence: 0.9,
  similarity: 0.95,
  occurrences: 1,
  firstSeen: '2026-05-16T20:00:00Z',
  lastSeen: '2026-05-20T20:00:00Z',
  module: 'payments',
  modules: ['payments'],
  code: 'GATEWAY_TIMEOUT',
  acknowledged: false,
  assignee: null
};

const incidents: Incident[] = [
  { ...baseIncident, id: 'inc-a', occurrences: 3 },
  {
    ...baseIncident,
    id: 'inc-b',
    severity: 'High',
    occurrences: 10,
    lastSeen: '2026-05-19T20:00:00Z'
  },
  {
    ...baseIncident,
    id: 'inc-c',
    title: 'Gateway timeout warning',
    occurrences: 7,
    lastSeen: '2026-05-18T20:00:00Z'
  },
  {
    ...baseIncident,
    id: 'inc-d',
    title: 'Gateway cache reset',
    status: 'New',
    occurrences: 5,
    lastSeen: '2026-05-17T20:00:00Z'
  },
  {
    ...baseIncident,
    id: 'inc-e',
    title: 'Database connection refused',
    summary: 'Postgres was unavailable',
    occurrences: 12,
    lastSeen: '2026-05-16T20:00:00Z'
  }
];

function getApplyIncidentQuery(): (items: Incident[], query?: IncidentQuery) => Incident[] {
  const candidate: unknown = Reflect.get(clientModule, 'applyIncidentQuery');
  assert.equal(typeof candidate, 'function');
  return candidate as (items: Incident[], query?: IncidentQuery) => Incident[];
}

test('search, severity, status, and sort compose without mutating the source list', () => {
  const applyIncidentQuery = getApplyIncidentQuery();
  const sourceIds = incidents.map((incident) => incident.id);

  const result = applyIncidentQuery(incidents, {
    q: 'gateway',
    severity: ['Critical'],
    status: ['Investigating'],
    sort: 'lastSeen',
    order: 'asc'
  });

  assert.deepEqual(result.map((incident) => incident.id), ['inc-c', 'inc-a']);
  assert.deepEqual(incidents.map((incident) => incident.id), sourceIds);
});

test('clearing one filter restores only rows still allowed by the other filters', () => {
  const applyIncidentQuery = getApplyIncidentQuery();

  const withoutSeverity = applyIncidentQuery(incidents, {
    q: 'gateway',
    status: ['Investigating'],
    sort: 'lastSeen',
    order: 'asc'
  });
  const withoutStatus = applyIncidentQuery(incidents, {
    q: 'gateway',
    severity: ['Critical'],
    sort: 'lastSeen',
    order: 'asc'
  });
  const searchOnly = applyIncidentQuery(incidents, {
    q: 'gateway',
    sort: 'occurrences',
    order: 'desc'
  });

  assert.deepEqual(withoutSeverity.map((incident) => incident.id), ['inc-c', 'inc-b', 'inc-a']);
  assert.deepEqual(withoutStatus.map((incident) => incident.id), ['inc-d', 'inc-c', 'inc-a']);
  assert.deepEqual(searchOnly.map((incident) => incident.id), ['inc-b', 'inc-c', 'inc-d', 'inc-a']);
});
