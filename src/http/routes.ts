import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import express from 'express';
import multer from 'multer';
import type { createAuthApp } from '../app/auth.js';
import type { createIncidentsApp } from '../app/incidents.js';
import type { createIngestApp } from '../app/ingest.js';
import type { createListApp } from '../app/list.js';
import type { createStatsApp } from '../app/stats.js';
import type { IncidentRepo } from '../domain/ports.js';
import { STATUSES, type Status } from '../domain/types.js';
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
  const upload = multer({ dest: 'data/uploads' });
  const api = express.Router();

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.post('/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    const result = await deps.auth.login(email, password);
    if (!result) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid credentials');
    res.json(result);
  });

  api.use(authMiddleware(deps.repo, deps.jwtSecret));

  api.get('/auth/me', async (req: AuthedRequest, res) => {
    const user = await deps.repo.findUserById(req.userId!);
    if (!user) return sendError(res, 401, 'UNAUTHORIZED', 'Invalid token');
    res.json(user);
  });

  api.post('/uploads', upload.array('files'), async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) return sendError(res, 400, 'VALIDATION_ERROR', 'At least one files field is required');
    for (const file of files) {
      const parsed = await deps.ingest.groupOnly(file.path);
      if (parsed.entries.length === 0) return sendError(res, 400, 'UNSUPPORTED_LOG_FORMAT', 'Uploaded file yielded zero parseable log blocks');
    }
    const jobId = randomUUID();
    await deps.repo.saveJob({ jobId, status: 'queued', progress: 0, parsed: 0, grouped: 0, error: null });
    void processUpload(jobId, files, deps);
    res.json({ jobId });
  });

  api.get('/uploads/:jobId', async (req, res) => {
    const job = await deps.repo.getJob(req.params.jobId);
    if (!job) return sendError(res, 404, 'NOT_FOUND', 'Upload job not found');
    res.json(job);
  });

  api.get('/incidents', async (req, res) => res.json(await deps.list.list(parseQuery(req.query))));
  api.get('/incidents/:id', async (req, res) => {
    const detail = await deps.list.detail(req.params.id);
    if (!detail) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(detail);
  });
  api.patch('/incidents/:id', async (req: AuthedRequest, res) => {
    const body = req.body as { status?: Status; assigneeId?: string | null; acknowledged?: boolean };
    if (body.status !== undefined && !STATUSES.includes(body.status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status');
    const updated = await deps.incidents.update(req.params.id, body, req.userId!);
    if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(updated);
  });
  api.post('/incidents/:id/notes', async (req: AuthedRequest, res) => {
    const { body } = req.body as { body?: string };
    if (!body) return sendError(res, 400, 'VALIDATION_ERROR', 'Note body is required');
    const activity = await deps.incidents.addNote(req.params.id, body, req.userId!);
    if (!activity) return sendError(res, 404, 'NOT_FOUND', 'Incident not found');
    res.json(activity);
  });
  api.get('/stats', async (_req, res) => res.json(await deps.stats.stats()));

  app.use('/api', api);
}

async function processUpload(jobId: string, files: Express.Multer.File[], deps: { repo: IncidentRepo; ingest: IngestApp }): Promise<void> {
  try {
    let parsed = 0;
    let grouped = 0;
    await deps.repo.saveJob({ jobId, status: 'parsing', progress: 5, parsed, grouped, error: null });
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      const result = await deps.ingest.ingestFile(file.path, file.originalname);
      parsed += result.parsed;
      grouped += result.grouped;
      await deps.repo.saveJob({ jobId, status: 'analyzing', progress: Math.round(((i + 1) / files.length) * 95), parsed, grouped, error: null });
    }
    await deps.repo.saveJob({ jobId, status: 'done', progress: 100, parsed, grouped, error: null });
  } catch (err) {
    await deps.repo.saveJob({ jobId, status: 'failed', progress: 100, parsed: 0, grouped: 0, error: err instanceof Error ? err.message : 'Upload failed' });
  }
}
