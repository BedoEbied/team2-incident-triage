import assert from 'node:assert/strict';
import test from 'node:test';

import mock from '../../contract/mock.json' with { type: 'json' };
import {
  buildIncidentQueryString,
  matchesIncidentQuery,
} from './incidentQuery.ts';

const incidents = [
  {
    id: 'connect',
    title: 'Connection timeout',
    summary: 'Connect timed out',
    severity: 'Critical',
    status: 'New',
    module: 'alpha',
    lastSeen: '2026-05-16T23:51:08Z',
  },
  {
    id: 'read',
    title: 'Connection timeout',
    summary: 'Read timed out',
    severity: 'High',
    status: 'Investigating',
    module: 'beta',
    lastSeen: '2026-05-17T00:01:00Z',
  },
  {
    id: 'auth',
    title: 'Authentication failure',
    summary: 'Token missing',
    severity: 'Critical',
    status: 'Investigating',
    module: 'alpha',
    lastSeen: '2026-05-17T08:00:00Z',
  },
];

test('serializes documented list query spellings', () => {
  assert.equal(
    buildIncidentQueryString({
      q: 'timeout',
      severity: ['Critical', 'High'],
      status: ['New', 'Investigating'],
      module: 'alpha',
      from: '2026-05-16',
      to: '2026-05-17',
      sort: 'lastSeen',
      order: 'asc',
    }),
    '?q=timeout&severity=Critical%2CHigh&status=New%2CInvestigating&module=alpha&from=2026-05-16&to=2026-05-17&sort=lastSeen&order=asc',
  );
});

test('composes every filter by narrowing the same incident set', () => {
  const query = {
    q: 'authentication',
    severity: ['Critical'],
    status: ['Investigating'],
    module: 'alpha',
    from: '2026-05-17',
    to: '2026-05-17',
  };

  assert.deepEqual(
    incidents.filter((incident) => matchesIncidentQuery(incident, query)).map(({ id }) => id),
    ['auth'],
  );
});

test('clearing one filter restores matching rows', () => {
  const narrowed = incidents.filter((incident) =>
    matchesIncidentQuery(incident, { q: 'timeout', severity: ['High'] }),
  );
  const restored = incidents.filter((incident) =>
    matchesIncidentQuery(incident, { q: 'timeout' }),
  );

  assert.deepEqual(narrowed.map(({ id }) => id), ['read']);
  assert.deepEqual(restored.map(({ id }) => id), ['connect', 'read']);
});

test('compares date filters against UTC date keys', () => {
  assert.equal(
    matchesIncidentQuery(incidents[0], { from: '2026-05-16', to: '2026-05-16' }),
    true,
  );
  assert.equal(matchesIncidentQuery(incidents[0], { from: '2026-05-17' }), false);
});

test('keeps the Location.Provider incident in the May 16 UTC filter result', () => {
  const matches = mock.incidents.filter((incident) =>
    matchesIncidentQuery(incident, {
      q: 'Location.Provider',
      severity: ['High'],
      status: ['Investigating'],
      module: 'src/tasks/order-retrial-task.ts',
      from: '2026-05-16',
      to: '2026-05-16',
    }),
  );

  assert.deepEqual(matches.map(({ id }) => id), ['inc_5ea9e31d10ee']);
});
