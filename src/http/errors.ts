import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { isPublicError } from '../domain/errors.js';
import type { ApiError } from '../domain/types.js';

export function sendError(res: Response, status: number, code: ApiError['error']['code'], message: string): void {
  res.status(status).json({ error: { code, message } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    const message = multerMessage(err.code);
    return sendError(res, 400, 'VALIDATION_ERROR', message);
  }
  if (isMalformedJson(err)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
  if (isPublicError(err)) {
    return sendError(res, err.httpStatus, err.apiCode, err.publicMessage);
  }
  console.error(err);
  sendError(res, 500, 'INTERNAL', 'Internal server error');
}

function multerMessage(code: string): string {
  if (code === 'LIMIT_FILE_SIZE') return 'Each file must be at most 10 MiB';
  if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
    return 'At most 5 files may be uploaded at once';
  }
  if (code === 'LIMIT_PART_COUNT') return 'Multipart request contains too many parts';
  return 'Invalid multipart upload';
}

function isMalformedJson(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false;
  return (error as SyntaxError & { type?: string }).type === 'entity.parse.failed';
}
