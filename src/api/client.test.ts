import assert from 'node:assert/strict';
import test from 'node:test';
import * as clientModule from './client';

type ClientErrorShape = Error & {
  status: number;
  code?: string;
};

function getCreateApiError(): (status: number, body: unknown) => ClientErrorShape {
  const candidate: unknown = Reflect.get(clientModule, 'createApiError');
  assert.equal(typeof candidate, 'function');
  return candidate as (status: number, body: unknown) => ClientErrorShape;
}

test('creates a typed unauthorized error from a contract error body', () => {
  const createApiError = getCreateApiError();
  const error = createApiError(401, {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Session expired'
    }
  });

  assert.equal(error.name, 'ApiClientError');
  assert.equal(error.status, 401);
  assert.equal(error.code, 'UNAUTHORIZED');
  assert.equal(error.message, 'Session expired');
});

test('uses a safe fallback for non-JSON and empty error bodies', () => {
  const createApiError = getCreateApiError();

  assert.equal(createApiError(502, '<html>Bad gateway</html>').message, 'Request failed (502)');
  assert.equal(createApiError(500, null).message, 'Request failed (500)');
});
