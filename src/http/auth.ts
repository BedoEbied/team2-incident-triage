import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { IncidentRepo } from '../domain/ports.js';
import { sendError } from './errors.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function authMiddleware(repo: IncidentRepo, secret: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return sendError(res, 401, 'UNAUTHORIZED', 'Missing bearer token');
    try {
      const payload = jwt.verify(match[1]!, secret) as { sub?: string };
      if (!payload.sub || !(await repo.findUserById(payload.sub))) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
      req.userId = payload.sub;
      next();
    } catch {
      sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
    }
  };
}
