import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '../domain/types.js';

export function sendError(res: Response, status: number, code: ApiError['error']['code'], message: string): void {
  res.status(status).json({ error: { code, message } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  sendError(res, 500, 'INTERNAL', 'Internal server error');
}
