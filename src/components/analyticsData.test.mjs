import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTopIncidentChartData } from './analyticsData.ts';

test('keeps incidents with duplicate titles distinct by id', () => {
  const data = buildTopIncidentChartData(
    [
      { id: 'connect-timeout', title: 'Connection timeouts', occurrences: 8 },
      { id: 'read-timeout', title: 'Connection timeouts', occurrences: 5 },
    ],
    ['#111111', '#222222'],
  );

  assert.deepEqual(
    data.map(({ id, title }) => ({ id, title })),
    [
      { id: 'connect-timeout', title: 'Connection timeouts' },
      { id: 'read-timeout', title: 'Connection timeouts' },
    ],
  );
});
