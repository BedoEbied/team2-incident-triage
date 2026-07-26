import assert from 'node:assert/strict';
import test from 'node:test';
import * as linksModule from './links';

type LinkHelpers = {
  incidentPath(id: string): string;
  notificationIncidentPath(value: unknown): string | null;
  routeParam(value: string | string[] | undefined): string;
};

function getLinkHelpers(): LinkHelpers {
  const incidentPath: unknown = Reflect.get(linksModule, 'incidentPath');
  const notificationIncidentPath: unknown = Reflect.get(linksModule, 'notificationIncidentPath');
  const routeParam: unknown = Reflect.get(linksModule, 'routeParam');

  assert.equal(typeof incidentPath, 'function');
  assert.equal(typeof notificationIncidentPath, 'function');
  assert.equal(typeof routeParam, 'function');

  return {
    incidentPath: incidentPath as LinkHelpers['incidentPath'],
    notificationIncidentPath:
      notificationIncidentPath as LinkHelpers['notificationIncidentPath'],
    routeParam: routeParam as LinkHelpers['routeParam']
  };
}

test('builds and accepts the same internal incident path', () => {
  const { incidentPath, notificationIncidentPath } = getLinkHelpers();
  const path = incidentPath('inc_d385961619b6');

  assert.equal(path, '/incident/inc_d385961619b6');
  assert.equal(notificationIncidentPath(path), path);
});

test('rejects untrusted or non-incident notification destinations', () => {
  const { notificationIncidentPath } = getLinkHelpers();

  assert.equal(notificationIncidentPath('https://example.com'), null);
  assert.equal(notificationIncidentPath('/settings'), null);
  assert.equal(notificationIncidentPath('/incident/'), null);
  assert.equal(notificationIncidentPath({ pathname: '/incident/inc-1' }), null);
});

test('normalizes cold-start dynamic route parameters', () => {
  const { routeParam } = getLinkHelpers();

  assert.equal(routeParam('inc-1'), 'inc-1');
  assert.equal(routeParam(['inc-1', 'ignored']), 'inc-1');
  assert.equal(routeParam(undefined), '');
});
