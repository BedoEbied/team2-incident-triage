import type { ApiError } from './types.js';

export interface PublicError extends Error {
  apiCode: ApiError['error']['code'];
  httpStatus: number;
  publicMessage: string;
}

export function createPublicError(
  apiCode: ApiError['error']['code'],
  publicMessage: string,
  httpStatus = 400,
): PublicError {
  return Object.assign(Reflect.construct(Error, [publicMessage]) as Error, {
    apiCode,
    httpStatus,
    publicMessage,
  });
}

export function isPublicError(error: unknown): error is PublicError {
  if (!(error instanceof Error)) return false;
  const candidate = error as Partial<PublicError>;
  return typeof candidate.apiCode === 'string'
    && typeof candidate.httpStatus === 'number'
    && typeof candidate.publicMessage === 'string';
}
