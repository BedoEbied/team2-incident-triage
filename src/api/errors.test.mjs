import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError, getErrorMessage } from './errors.ts';

test('surfaces a clear unauthorized message', () => {
  const error = new HttpError(401, {
    code: 'UNAUTHORIZED',
    message: 'Unauthorized',
  });

  assert.equal(
    getErrorMessage(error),
    'Your session is missing or expired. Sign in again.',
  );
});

test('preserves actionable contract messages', () => {
  for (const [status, code] of [
    [404, 'NOT_FOUND'],
    [400, 'UNSUPPORTED_LOG_FORMAT'],
    [400, 'VALIDATION_ERROR'],
  ]) {
    const message = `${code} details`;
    assert.equal(getErrorMessage(new HttpError(status, { code, message })), message);
  }
});

test('replaces internal errors with a recoverable message', () => {
  const error = new HttpError(500, {
    code: 'INTERNAL',
    message: 'Database credentials leaked here',
  });

  assert.equal(
    getErrorMessage(error),
    'The server could not complete the request. Try again.',
  );
});

test('explains network failures', () => {
  assert.equal(
    getErrorMessage(new TypeError('Failed to fetch')),
    'Could not reach the incident API. Check your connection and try again.',
  );
});
