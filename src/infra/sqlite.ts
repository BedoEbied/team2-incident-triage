import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { createPublicError } from '../domain/errors.js';
import type { Analyzer, GroupedIncident, IncidentRepo, ParsedLogEntry } from '../domain/ports.js';
import type { Activity, Incident, IncidentDetail, IncidentQuery, LogEntry, Stats, Status, UploadJob, User } from '../domain/types.js';
import { SEVERITIES, SEVERITY_RANK, STATUSES } from '../domain/types.js';
import { fingerprint, normalize } from './fingerprint.js';

type Db = Database.Database;
type Row = Record<string, unknown>;

export function createSqliteRepo(db: Db): IncidentRepo {
  return {
    init() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS log_file (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, ingested_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS incident (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, severity TEXT NOT NULL,
          status TEXT NOT NULL, root_cause TEXT NOT NULL, remediation TEXT NOT NULL, confidence REAL NOT NULL, similarity REAL NOT NULL,
          occurrences INTEGER NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, module TEXT NOT NULL, modules TEXT NOT NULL,
          code TEXT, acknowledged INTEGER NOT NULL, assignee_id TEXT
        );
        CREATE TABLE IF NOT EXISTS log_entry (
          id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, file_id TEXT NOT NULL, timestamp TEXT NOT NULL, level TEXT NOT NULL,
          message TEXT NOT NULL, code TEXT, module TEXT NOT NULL, stack TEXT NOT NULL,
          fingerprint TEXT NOT NULL, normalized_message TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity (
          id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL,
          from_value TEXT, to_value TEXT, body TEXT
        );
        CREATE TABLE IF NOT EXISTS upload_job (job_id TEXT PRIMARY KEY, status TEXT NOT NULL, progress INTEGER NOT NULL, parsed INTEGER NOT NULL, grouped INTEGER NOT NULL, error TEXT);
        CREATE TABLE IF NOT EXISTS staging_file (
          job_id TEXT NOT NULL, file_index INTEGER NOT NULL, file_name TEXT NOT NULL, entry_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (job_id, file_index)
        );
        CREATE TABLE IF NOT EXISTS staging_entry (
          job_id TEXT NOT NULL, file_index INTEGER NOT NULL, entry_index INTEGER NOT NULL, timestamp TEXT NOT NULL,
          level TEXT NOT NULL, message TEXT NOT NULL, code TEXT, module TEXT NOT NULL, stack TEXT NOT NULL,
          fingerprint TEXT NOT NULL, normalized_message TEXT NOT NULL,
          PRIMARY KEY (job_id, file_index, entry_index)
        );
      `);
      ensureLogEntryColumns(db);
      backfillLogEntryGrouping(db);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_log_entry_fingerprint ON log_entry(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_staging_entry_job_fingerprint ON staging_entry(job_id, fingerprint);
        UPDATE upload_job
        SET status = 'failed', progress = 100, error = 'Upload interrupted before completion'
        WHERE status IN ('queued', 'parsing', 'analyzing');
        DELETE FROM staging_entry;
        DELETE FROM staging_file;
      `);
    },
    async seedUser(email, password, name) {
      const existing = db.prepare('SELECT id, name, email, password_hash as passwordHash FROM user WHERE email = ?').get(email) as (User & { passwordHash: string }) | undefined;
      if (existing) return toUser(existing);
      const id = randomUUID();
      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO user (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, name, email, hash);
      return { id, name, email };
    },
    async findUserByEmail(email) {
      const row = db.prepare('SELECT id, name, email, password_hash as passwordHash FROM user WHERE email = ?').get(email) as (User & { passwordHash: string }) | undefined;
      return row ?? null;
    },
    async findUserById(id) {
      const row = db.prepare('SELECT id, name, email FROM user WHERE id = ?').get(id) as User | undefined;
      return row ?? null;
    },
    async isEmpty() {
      const row = db.prepare('SELECT COUNT(*) as count FROM incident').get() as { count: number };
      return row.count === 0;
    },
    async ingest(fileName, groups, analyzer) {
      const jobId = randomUUID();
      beginStaging(db, jobId, [{ fileIndex: 0, fileName }]);
      try {
        for (const group of groups) {
          for (const item of group.entries) stageEntry(db, jobId, 0, item);
        }
        commitStaged(db, jobId, analyzer);
      } finally {
        clearStaging(db, jobId);
      }
    },
    async beginStaging(jobId, files) {
      beginStaging(db, jobId, files);
    },
    async stageEntry(jobId, fileIndex, entry) {
      stageEntry(db, jobId, fileIndex, entry);
    },
    async commitStaged(jobId, analyzer) {
      return commitStaged(db, jobId, analyzer);
    },
    async clearStaging(jobId) {
      clearStaging(db, jobId);
    },
    async list(query) {
      const rows = db.prepare(incidentSelect()).all() as Row[];
      let items = rows.map(toIncident);
      items = filterIncidents(items, query);
      items = sortIncidents(items, query.sort ?? 'severity', query.order ?? 'desc');
      return { items, total: items.length };
    },
    async detail(id) {
      const row = db.prepare(`${incidentSelect()} WHERE incident.id = ?`).get(id) as Row | undefined;
      if (!row) return null;
      const entries = db.prepare('SELECT id, incident_id as incidentId, timestamp, level, message, code, module, stack FROM log_entry WHERE incident_id = ? ORDER BY timestamp DESC LIMIT 100').all(id) as LogEntry[];
      const history = db.prepare('SELECT id, incident_id as incidentId, at, actor, type, from_value as "from", to_value as "to", body FROM activity WHERE incident_id = ? ORDER BY at DESC').all(id) as Activity[];
      return { ...toIncident(row), entries, history };
    },
    async updateIncident(id, patch, actor) {
      const before = await this.detail(id);
      if (!before) return null;
      db.transaction(() => {
        if (patch.status !== undefined && patch.status !== before.status) {
          db.prepare('UPDATE incident SET status = ? WHERE id = ?').run(patch.status, id);
          db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), id, nowIso(), actor, 'status', before.status, patch.status);
        }
        if (patch.assigneeId !== undefined && patch.assigneeId !== (before.assignee?.id ?? null)) {
          db.prepare('UPDATE incident SET assignee_id = ? WHERE id = ?').run(patch.assigneeId, id);
          db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), id, nowIso(), actor, 'assign', before.assignee?.id ?? null, patch.assigneeId);
        }
        if (patch.acknowledged !== undefined && patch.acknowledged !== before.acknowledged) {
          db.prepare('UPDATE incident SET acknowledged = ? WHERE id = ?').run(patch.acknowledged ? 1 : 0, id);
          db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(randomUUID(), id, nowIso(), actor, 'ack', String(before.acknowledged), String(patch.acknowledged));
        }
      })();
      return (await this.detail(id))!;
    },
    async addNote(id, body, actor) {
      if (!(await this.detail(id))) return null;
      const activity: Activity = { id: randomUUID(), incidentId: id, at: nowIso(), actor, type: 'note', body };
      db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, body) VALUES (?, ?, ?, ?, ?, ?)')
        .run(activity.id, activity.incidentId, activity.at, activity.actor, activity.type, activity.body);
      return activity;
    },
    async stats() {
      const incidents = (await this.list({})).items;
      const bySeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
      const byStatus = { New: 0, Investigating: 0, Resolved: 0 };
      for (const item of incidents) {
        bySeverity[item.severity] += 1;
        byStatus[item.status] += 1;
      }
      const trendRows = db.prepare("SELECT date(timestamp) as date, COUNT(*) as count FROM log_entry GROUP BY date(timestamp) ORDER BY date(timestamp)").all() as { date: string; count: number }[];
      return {
        total: incidents.length,
        bySeverity,
        byStatus,
        topIncidents: [...incidents].sort((a, b) => b.occurrences - a.occurrences).slice(0, 5).map(({ id, title, occurrences }) => ({ id, title, occurrences })),
        trend: trendRows,
      } satisfies Stats;
    },
    async saveJob(job) {
      db.prepare('INSERT INTO upload_job (job_id, status, progress, parsed, grouped, error) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, progress=excluded.progress, parsed=excluded.parsed, grouped=excluded.grouped, error=excluded.error')
        .run(job.jobId, job.status, job.progress, job.parsed, job.grouped, job.error);
    },
    async getJob(id) {
      const row = db.prepare('SELECT job_id as jobId, status, progress, parsed, grouped, error FROM upload_job WHERE job_id = ?').get(id) as UploadJob | undefined;
      return row ?? null;
    },
  };
}

function ensureLogEntryColumns(db: Db): void {
  const columns = db.prepare('PRAGMA table_info(log_entry)').all() as { name: string }[];
  if (!columns.some(({ name }) => name === 'fingerprint')) {
    db.exec('ALTER TABLE log_entry ADD COLUMN fingerprint TEXT');
  }
  if (!columns.some(({ name }) => name === 'normalized_message')) {
    db.exec('ALTER TABLE log_entry ADD COLUMN normalized_message TEXT');
  }
}

function backfillLogEntryGrouping(db: Db): void {
  const rows = db.prepare(
    'SELECT id, message FROM log_entry WHERE fingerprint IS NULL OR normalized_message IS NULL',
  ).all() as { id: string; message: string }[];
  if (!rows.length) return;
  const update = db.prepare('UPDATE log_entry SET fingerprint = ?, normalized_message = ? WHERE id = ?');
  db.transaction(() => {
    for (const row of rows) update.run(fingerprint(row.message), normalize(row.message), row.id);
  })();
}

function beginStaging(
  db: Db,
  jobId: string,
  files: { fileIndex: number; fileName: string }[],
): void {
  const names = files.map(({ fileName }) => fileName);
  if (names.some((name, index) => names.indexOf(name) !== index)) {
    throw createPublicError('VALIDATION_ERROR', 'Uploaded file names must be unique');
  }
  const insert = db.prepare(
    'INSERT INTO staging_file (job_id, file_index, file_name, entry_count) VALUES (?, ?, ?, 0)',
  );
  db.transaction(() => {
    clearStagingRows(db, jobId);
    for (const file of files) insert.run(jobId, file.fileIndex, file.fileName);
  })();
}

function stageEntry(db: Db, jobId: string, fileIndex: number, entry: ParsedLogEntry): void {
  const file = db.prepare(
    'SELECT entry_count as entryCount FROM staging_file WHERE job_id = ? AND file_index = ?',
  ).get(jobId, fileIndex) as { entryCount: number } | undefined;
  if (!file) throw Reflect.construct(Error, ['Staging file was not initialized']) as Error;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO staging_entry (
        job_id, file_index, entry_index, timestamp, level, message, code, module, stack, fingerprint, normalized_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      fileIndex,
      file.entryCount,
      entry.timestamp,
      entry.level,
      entry.message,
      entry.code,
      entry.module,
      entry.stack,
      fingerprint(entry.message),
      normalize(entry.message),
    );
    db.prepare(
      'UPDATE staging_file SET entry_count = entry_count + 1 WHERE job_id = ? AND file_index = ?',
    ).run(jobId, fileIndex);
  })();
}

function commitStaged(db: Db, jobId: string, analyzer: Analyzer): { parsed: number; grouped: number } {
  const transaction = db.transaction(() => {
    const files = db.prepare(`
      SELECT file_index as fileIndex, file_name as fileName, entry_count as entryCount
      FROM staging_file WHERE job_id = ? ORDER BY file_index
    `).all(jobId) as { fileIndex: number; fileName: string; entryCount: number }[];
    if (!files.length) throw Reflect.construct(Error, ['Upload staging was not initialized']) as Error;
    if (files.some(({ entryCount }) => entryCount === 0)) {
      throw createPublicError('UNSUPPORTED_LOG_FORMAT', 'Uploaded file yielded zero parseable log blocks');
    }

    const parsed = files.reduce((sum, file) => sum + file.entryCount, 0);
    const groupedRow = db.prepare(
      'SELECT COUNT(DISTINCT fingerprint) as count FROM staging_entry WHERE job_id = ?',
    ).get(jobId) as { count: number };
    const affected = Object.create(null) as Record<string, true>;

    for (const file of files) {
      const stored = db.prepare('SELECT id FROM log_file WHERE name = ?').get(file.fileName) as { id: string } | undefined;
      if (!stored) continue;
      const oldFingerprints = db.prepare(
        'SELECT DISTINCT fingerprint FROM log_entry WHERE file_id = ?',
      ).all(stored.id) as { fingerprint: string }[];
      for (const row of oldFingerprints) affected[row.fingerprint] = true;
    }
    const stagedFingerprints = db.prepare(
      'SELECT DISTINCT fingerprint FROM staging_entry WHERE job_id = ?',
    ).all(jobId) as { fingerprint: string }[];
    for (const row of stagedFingerprints) affected[row.fingerprint] = true;

    for (const file of files) {
      const stored = db.prepare('SELECT id FROM log_file WHERE name = ?').get(file.fileName) as { id: string } | undefined;
      if (stored) db.prepare('DELETE FROM log_entry WHERE file_id = ?').run(stored.id);
    }

    for (const file of files) {
      db.prepare(`
        INSERT INTO log_file (id, name, ingested_at) VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET ingested_at = excluded.ingested_at
      `).run(randomUUID(), file.fileName, nowIso());
      const stored = db.prepare('SELECT id FROM log_file WHERE name = ?').get(file.fileName) as { id: string };
      const stagedRow = db.prepare(`
        SELECT timestamp, level, message, code, module, stack, fingerprint, normalized_message as normalizedMessage
        FROM staging_entry WHERE job_id = ? AND file_index = ? AND entry_index = ?
      `);

      for (let entryIndex = 0; entryIndex < file.entryCount; entryIndex += 1) {
        const row = stagedRow.get(jobId, file.fileIndex, entryIndex) as StagedRow;
        const existing = db.prepare('SELECT id FROM incident WHERE fingerprint = ?').get(row.fingerprint) as { id: string } | undefined;
        const live = db.prepare('SELECT incident_id as incidentId FROM log_entry WHERE fingerprint = ? LIMIT 1').get(row.fingerprint) as { incidentId: string } | undefined;
        const incidentId = existing?.id ?? live?.incidentId ?? randomUUID();
        db.prepare(`
          INSERT INTO log_entry (
            id, incident_id, file_id, timestamp, level, message, code, module, stack, fingerprint, normalized_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(), incidentId, stored.id, row.timestamp, row.level, row.message, row.code, row.module,
          row.stack, row.fingerprint, row.normalizedMessage,
        );
      }
    }

    for (const affectedFingerprint of Object.keys(affected)) {
      recomputeIncident(db, affectedFingerprint, analyzer);
    }
    clearStagingRows(db, jobId);
    return { parsed, grouped: groupedRow.count };
  });
  return transaction();
}

interface StagedRow {
  timestamp: string;
  level: string;
  message: string;
  code: string | null;
  module: string;
  stack: string;
  fingerprint: string;
  normalizedMessage: string;
}

function recomputeIncident(db: Db, incidentFingerprint: string, analyzer: Analyzer): void {
  const totals = db.prepare(`
    SELECT COUNT(*) as occurrences, MIN(timestamp) as firstSeen, MAX(timestamp) as lastSeen
    FROM log_entry WHERE fingerprint = ?
  `).get(incidentFingerprint) as { occurrences: number; firstSeen: string | null; lastSeen: string | null };
  if (totals.occurrences === 0 || !totals.firstSeen || !totals.lastSeen) {
    const existing = db.prepare('SELECT id FROM incident WHERE fingerprint = ?').get(incidentFingerprint) as { id: string } | undefined;
    if (existing) {
      db.prepare('DELETE FROM activity WHERE incident_id = ?').run(existing.id);
      db.prepare('DELETE FROM incident WHERE id = ?').run(existing.id);
    }
    return;
  }

  const modal = db.prepare(`
    SELECT normalized_message as normalizedMessage, MIN(message) as message, COUNT(*) as count
    FROM log_entry WHERE fingerprint = ?
    GROUP BY normalized_message ORDER BY count DESC, normalized_message ASC LIMIT 1
  `).get(incidentFingerprint) as { normalizedMessage: string; message: string; count: number };
  const modalModule = db.prepare(`
    SELECT module, COUNT(*) as count FROM log_entry WHERE fingerprint = ?
    GROUP BY module ORDER BY count DESC, module ASC LIMIT 1
  `).get(incidentFingerprint) as { module: string; count: number };
  const modules = db.prepare(
    'SELECT DISTINCT module FROM log_entry WHERE fingerprint = ? ORDER BY module',
  ).all(incidentFingerprint) as { module: string }[];
  const modalCode = db.prepare(`
    SELECT code, COUNT(*) as count FROM log_entry
    WHERE fingerprint = ? AND code IS NOT NULL AND code <> ''
    GROUP BY code ORDER BY count DESC, code ASC LIMIT 1
  `).get(incidentFingerprint) as { code: string; count: number } | undefined;
  const group: GroupedIncident = {
    fingerprint: incidentFingerprint,
    normalizedMessage: modal.normalizedMessage,
    message: modal.message,
    occurrences: totals.occurrences,
    firstSeen: totals.firstSeen,
    lastSeen: totals.lastSeen,
    module: modalModule.module,
    modules: modules.map(({ module }) => module),
    code: modalCode?.code ?? null,
    similarity: modal.count / totals.occurrences,
    entries: [],
  };
  const analysis = analyzer.analyze(group);
  const existing = db.prepare(
    'SELECT id, status, acknowledged, assignee_id FROM incident WHERE fingerprint = ?',
  ).get(incidentFingerprint) as Row | undefined;
  const member = db.prepare(
    'SELECT incident_id as incidentId FROM log_entry WHERE fingerprint = ? LIMIT 1',
  ).get(incidentFingerprint) as { incidentId: string };
  const id = typeof existing?.id === 'string' ? existing.id : member.incidentId;
  db.prepare('UPDATE log_entry SET incident_id = ? WHERE fingerprint = ?').run(id, incidentFingerprint);
  db.prepare(`
    INSERT INTO incident (
      id, fingerprint, title, summary, severity, status, root_cause, remediation, confidence, similarity,
      occurrences, first_seen, last_seen, module, modules, code, acknowledged, assignee_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fingerprint) DO UPDATE SET
      title = excluded.title, summary = excluded.summary, severity = excluded.severity,
      root_cause = excluded.root_cause, remediation = excluded.remediation, confidence = excluded.confidence,
      similarity = excluded.similarity, occurrences = excluded.occurrences, first_seen = excluded.first_seen,
      last_seen = excluded.last_seen, module = excluded.module, modules = excluded.modules, code = excluded.code
  `).run(
    id, incidentFingerprint, analysis.title, analysis.summary, analysis.severity,
    existing ? existing.status : 'New', analysis.rootCause, analysis.remediation, analysis.confidence,
    group.similarity, group.occurrences, group.firstSeen, group.lastSeen, group.module,
    JSON.stringify(group.modules), group.code, existing ? existing.acknowledged : 0,
    existing ? existing.assignee_id : null,
  );
}

function clearStaging(db: Db, jobId: string): void {
  db.transaction(() => clearStagingRows(db, jobId))();
}

function clearStagingRows(db: Db, jobId: string): void {
  db.prepare('DELETE FROM staging_entry WHERE job_id = ?').run(jobId);
  db.prepare('DELETE FROM staging_file WHERE job_id = ?').run(jobId);
}

function incidentSelect(): string {
  return `SELECT incident.*, user.id as assigneeUserId, user.name as assigneeName FROM incident LEFT JOIN user ON user.id = incident.assignee_id`;
}

function toIncident(row: Row): Incident {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    title: String(row.title),
    summary: String(row.summary),
    severity: row.severity as Incident['severity'],
    status: row.status as Incident['status'],
    rootCause: String(row.root_cause),
    remediation: String(row.remediation),
    confidence: Number(row.confidence),
    similarity: Number(row.similarity),
    occurrences: Number(row.occurrences),
    firstSeen: String(row.first_seen),
    lastSeen: String(row.last_seen),
    module: String(row.module),
    modules: JSON.parse(String(row.modules)) as string[],
    code: typeof row.code === 'string' ? row.code : null,
    acknowledged: Boolean(row.acknowledged),
    assignee: typeof row.assigneeUserId === 'string' ? { id: row.assigneeUserId, name: String(row.assigneeName) } : null,
  };
}

function toUser(row: User & { passwordHash: string }): User {
  return { id: row.id, name: row.name, email: row.email };
}

function filterIncidents(items: Incident[], query: IncidentQuery): Incident[] {
  return items.filter((item) => {
    if (query.q && !`${item.title} ${item.summary}`.toLowerCase().includes(query.q.toLowerCase())) return false;
    if (query.severity?.length && !query.severity.includes(item.severity)) return false;
    if (query.status?.length && !query.status.includes(item.status)) return false;
    if (query.module && item.module !== query.module) return false;
    if (query.from && item.lastSeen.slice(0, 10) < query.from) return false;
    if (query.to && item.lastSeen.slice(0, 10) > query.to) return false;
    return true;
  });
}

function sortIncidents(items: Incident[], sort: 'severity' | 'occurrences' | 'lastSeen', order: 'asc' | 'desc'): Incident[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = sort === 'severity' ? SEVERITY_RANK[a.severity] : a[sort];
    const bv = sort === 'severity' ? SEVERITY_RANK[b.severity] : b[sort];
    return av > bv ? direction : av < bv ? -direction : 0;
  });
}

function nowIso(): string {
  return (Reflect.construct(Date, []) as Date).toISOString();
}

export function parseQuery(input: Record<string, unknown>): IncidentQuery {
  const severity = parseCsv(input.severity).filter((value): value is Incident['severity'] => SEVERITIES.includes(value as Incident['severity']));
  const status = parseCsv(input.status).filter((value): value is Status => STATUSES.includes(value as Status));
  return {
    q: stringValue(input.q),
    severity: severity.length ? severity : undefined,
    status: status.length ? status : undefined,
    module: stringValue(input.module),
    from: stringValue(input.from),
    to: stringValue(input.to),
    sort: input.sort === 'occurrences' || input.sort === 'lastSeen' || input.sort === 'severity' ? input.sort : undefined,
    order: input.order === 'asc' || input.order === 'desc' ? input.order : undefined,
  };
}

function parseCsv(value: unknown): string[] {
  return typeof value === 'string' ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
