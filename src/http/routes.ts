import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import express from 'express';
import multer from 'multer';
import type { createAuthApp } from '../app/auth.js';
import type { createIncidentsApp } from '../app/incidents.js';
import type { createIngestApp } from '../app/ingest.js';
import type { createListApp } from '../app/list.js';
import type { createStatsApp } from '../app/stats.js';
import type { IncidentRepo } from '../domain/ports.js';
import { STATUSES, type Status } from '../domain/types.js';
import { isPublicError } from '../domain/errors.js';
import { parseQuery } from '../infra/sqlite.js';
import { type AuthedRequest, authMiddleware } from './auth.js';
import { sendError } from './errors.js';

type AuthApp = ReturnType<typeof createAuthApp>;
type IngestApp = ReturnType<typeof createIngestApp>;
type ListApp = ReturnType<typeof createListApp>;
type StatsApp = ReturnType<typeof createStatsApp>;
type IncidentsApp = ReturnType<typeof createIncidentsApp>;

export function registerRoutes(
  app: Express,
  deps: { repo: IncidentRepo; auth: AuthApp; ingest: IngestApp; list: ListApp; stats: StatsApp; incidents: IncidentsApp; jwtSecret: string },
): void {
  const upload = multer({
    storage: multer.diskStorage({
      destination: 'data/uploads',
      filename: (_req, _file, callback) => callback(null, randomUUID()),
    }),
    limits: {
      files: 5,
      fileSize: 10 * 1024 * 1024,
      parts: 10,
      fields: 5,
    },
  });
  const uploadFiles: RequestHandler = (req, res, next) => {
    upload.array('files', 5)(req, res, (error) => {
      if (!error) return next();
      void cleanupFiles(req.files).then(() => next(error));
    });
  };
  const api = express.Router();

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.post('/auth/login', asyncRoute(async (req, res) => {
    const body = objectBody(req.body);
    const email = body?.email;
    const password = body?.password;
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }
    const result = await deps.auth.login(email, password);
    if (!result) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid credentials');
    res.json(result);
  }));

  api.use(authMiddleware(deps.repo, deps.jwtSecret));

  api.get('/auth/me', asyncRoute(async (req: AuthedRequest, res) => {
    const user = await deps.repo.findUserById(req.userId!);
    if (!user) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
    res.json(user);
  }));

  api.post('/uploads', uploadFiles, asyncRoute(async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) return sendError(res, 400, 'VALIDATION_ERROR', 'At least one files field is required');
    const jobId = randomUUID();
    let jobCreated = false;
    try {
      await deps.repo.saveJob({ jobId, status: 'queued', progress: 0, parsed: 0, grouped: 0, error: null });
      jobCreated = true;
      await deps.repo.saveJob({ jobId, status: 'parsing', progress: 5, parsed: 0, grouped: 0, error: null });
      const result = await deps.ingest.ingestFiles(
        jobId,
        files.map(({ path, originalname }) => ({ path, fileName: originalname })),
      );
      await deps.repo.saveJob({
        jobId,
        status: 'analyzing',
        progress: 95,
        parsed: result.parsed,
        grouped: result.grouped,
        error: null,
      });
      await deps.repo.saveJob({
        jobId,
        status: 'done',
        progress: 100,
        parsed: result.parsed,
        grouped: result.grouped,
        error: null,
      });
      res.json({ jobId });
    } catch (error) {
      const message = isPublicError(error) ? error.publicMessage : 'Upload failed';
      if (jobCreated) {
        await deps.repo.saveJob({
          jobId,
          status: 'failed',
          progress: 100,
          parsed: 0,
          grouped: 0,
          error: message,
        });
      }
      throw error;
    } finally {
      await cleanupFiles(files);
    }
  }));

  api.get('/uploads/:jobId', asyncRoute(async (req, res) => {
    const job = await deps.repo.getJob(req.params.jobId);
    if (!job) return sendError(res, 404, 'NOT_FOUND', 'Upload job not found');
    res.json(job);
  }));

  api.get('/incidents', asyncRoute(async (req, res) => res.json(await deps.list.list(parseQuery(req.query)))));
  api.get('/incidents/:id', asyncRoute(async (req, res) => {
    const detail = await deps.list.detail(req.params.id);
    if (!detail) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(detail);
  }));
  api.patch('/incidents/:id', asyncRoute(async (req: AuthedRequest, res) => {
    const body = objectBody(req.body);
    const allowed = ['status', 'assigneeId', 'acknowledged'];
    const keys = body ? Object.keys(body) : [];
    if (!body || keys.length === 0 || keys.some((key) => !allowed.includes(key))) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'PATCH body must contain supported fields');
    }
    if (body.status !== undefined && (
      typeof body.status !== 'string'
      || !STATUSES.includes(body.status as Status)
    )) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status');
    }
    if (body.assigneeId !== undefined && body.assigneeId !== null && (
      typeof body.assigneeId !== 'string'
      || !body.assigneeId.trim()
    )) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid assigneeId');
    }
    if (body.acknowledged !== undefined && typeof body.acknowledged !== 'boolean') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid acknowledged value');
    }
    if (typeof body.assigneeId === 'string' && !(await deps.repo.findUserById(body.assigneeId))) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid assigneeId');
    }
    const patch: { status?: Status; assigneeId?: string | null; acknowledged?: boolean } = {};
    if (body.status !== undefined) patch.status = body.status as Status;
    if (body.assigneeId !== undefined) patch.assigneeId = body.assigneeId as string | null;
    if (body.acknowledged !== undefined) patch.acknowledged = body.acknowledged as boolean;
    const updated = await deps.incidents.update(req.params.id, patch, req.userId!);
    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(updated);
  }));
  api.post('/incidents/:id/notes', asyncRoute(async (req: AuthedRequest, res) => {
    const input = objectBody(req.body);
    if (!input || Object.keys(input).length !== 1 || typeof input.body !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Note body is required');
    }
    const body = input.body.trim();
    if (!body || body.length > 10_000) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Note body must contain 1 to 10,000 characters');
    }
    const activity = await deps.incidents.addNote(req.params.id, body, req.userId!);
    if (!activity) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(activity);
  }));
  api.get('/stats', asyncRoute(async (_req, res) => res.json(await deps.stats.stats())));

  app.use('/api', api);
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

async function cleanupFiles(input: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined): Promise<void> {
  const files = Array.isArray(input) ? input : [];
  await Promise.allSettled(files.map(({ path }) => unlink(path)));
}

function objectBody(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : null;
}
