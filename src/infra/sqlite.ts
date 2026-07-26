import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import type { Analyzer, GroupedIncident, IncidentRepo } from '../domain/ports.js';
import type { Activity, Incident, IncidentDetail, IncidentQuery, LogEntry, Stats, Status, UploadJob, User } from '../domain/types.js';
import { SEVERITIES, SEVERITY_RANK, STATUSES } from '../domain/types.js';

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
          message TEXT NOT NULL, code TEXT, module TEXT NOT NULL, stack TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity (
          id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL,
          from_value TEXT, to_value TEXT, body TEXT
        );
        CREATE TABLE IF NOT EXISTS upload_job (job_id TEXT PRIMARY KEY, status TEXT NOT NULL, progress INTEGER NOT NULL, parsed INTEGER NOT NULL, grouped INTEGER NOT NULL, error TEXT);
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
      const tx = db.transaction((items: GroupedIncident[]) => {
        const fileId = randomUUID();
        db.prepare('INSERT OR IGNORE INTO log_file (id, name, ingested_at) VALUES (?, ?, ?)').run(fileId, fileName, nowIso());
        const storedFile = db.prepare('SELECT id FROM log_file WHERE name = ?').get(fileName) as { id: string };
        db.prepare('DELETE FROM log_entry WHERE file_id = ?').run(storedFile.id);
        for (const group of items) {
          const analysis = analyzer.analyze(group);
          const existing = db.prepare('SELECT id, status, acknowledged, assignee_id FROM incident WHERE fingerprint = ?').get(group.fingerprint) as Row | undefined;
          const id = typeof existing?.id === 'string' ? existing.id : randomUUID();
          db.prepare(`
            INSERT INTO incident (id, fingerprint, title, summary, severity, status, root_cause, remediation, confidence, similarity, occurrences, first_seen, last_seen, module, modules, code, acknowledged, assignee_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fingerprint) DO UPDATE SET title=excluded.title, summary=excluded.summary, severity=excluded.severity,
              root_cause=excluded.root_cause, remediation=excluded.remediation, confidence=excluded.confidence, similarity=excluded.similarity,
              occurrences=excluded.occurrences, first_seen=excluded.first_seen, last_seen=excluded.last_seen, module=excluded.module,
              modules=excluded.modules, code=excluded.code
          `).run(
            id, group.fingerprint, analysis.title, analysis.summary, analysis.severity, existing ? existing.status : 'New',
            analysis.rootCause, analysis.remediation, analysis.confidence, group.similarity, group.occurrences, group.firstSeen,
            group.lastSeen, group.module, JSON.stringify(group.modules), group.code, existing ? existing.acknowledged : 0,
            existing ? existing.assignee_id : null,
          );
          for (const entry of group.entries) {
            db.prepare('INSERT INTO log_entry (id, incident_id, file_id, timestamp, level, message, code, module, stack) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(randomUUID(), id, storedFile.id, entry.timestamp, entry.level, entry.message, entry.code, entry.module, entry.stack);
          }
        }
      });
      tx(groups);
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
      if (patch.status !== undefined) {
        db.prepare('UPDATE incident SET status = ? WHERE id = ?').run(patch.status, id);
        db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), id, nowIso(), actor, 'status', before.status, patch.status);
      }
      if (patch.assigneeId !== undefined) {
        db.prepare('UPDATE incident SET assignee_id = ? WHERE id = ?').run(patch.assigneeId, id);
        db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), id, nowIso(), actor, 'assign', before.assignee?.id ?? null, patch.assigneeId);
      }
      if (patch.acknowledged !== undefined) {
        db.prepare('UPDATE incident SET acknowledged = ? WHERE id = ?').run(patch.acknowledged ? 1 : 0, id);
        db.prepare('INSERT INTO activity (id, incident_id, at, actor, type, from_value, to_value) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), id, nowIso(), actor, 'ack', String(before.acknowledged), String(patch.acknowledged));
      }
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
