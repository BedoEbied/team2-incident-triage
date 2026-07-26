import type { ApiError } from './types';

const API_ERROR_CODES = new Set<ApiError['error']['code']>([
  'UNAUTHORIZED',
  'NOT_FOUND',
  'UNSUPPORTED_LOG_FORMAT',
  'VALIDATION_ERROR',
  'INTERNAL',
]);

export class HttpError extends Error {
  code: ApiError['error']['code'];
  status: number;

  constructor(status: number, error: ApiError['error']) {
    super(error.message);
    this.name = 'HttpError';
    this.status = status;
    this.code = error.code;
  }
}

export function parseApiError(value: unknown): ApiError['error'] | null {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return null;
  }

  const error = value.error;
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    !('message' in error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string' ||
    !API_ERROR_CODES.has(error.code as ApiError['error']['code'])
  ) {
    return null;
  }

  return {
    code: error.code as ApiError['error']['code'],
    message: error.message,
  };
}

export function fallbackApiError(status: number): ApiError['error'] {
  if (status === 401) {
    return { code: 'UNAUTHORIZED', message: 'Authentication is required.' };
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', message: 'The requested resource was not found.' };
  }
  if (status === 400) {
    return { code: 'VALIDATION_ERROR', message: 'The request was not accepted.' };
  }
  return { code: 'INTERNAL', message: 'The server request failed.' };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Your session is missing or expired. Sign in again.';
      case 'NOT_FOUND':
      case 'UNSUPPORTED_LOG_FORMAT':
      case 'VALIDATION_ERROR':
        return error.message;
      case 'INTERNAL':
        return 'The server could not complete the request. Try again.';
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Could not reach the incident API. Check your connection and try again.';
  }

  return error instanceof Error ? error.message : 'Unexpected error';
}
