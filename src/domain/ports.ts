import type {
  Activity,
  Incident,
  IncidentDetail,
  IncidentQuery,
  LogEntry,
  Severity,
  Stats,
  Status,
  UploadJob,
  User,
} from './types.js';

export interface ParsedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  code: string | null;
  module: string;
  symbol: string;
  stack: string;
}

export interface GroupedIncident {
  fingerprint: string;
  normalizedMessage: string;
  message: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  module: string;
  modules: string[];
  code: string | null;
  similarity: number;
  entries: ParsedLogEntry[];
}

export interface Analysis {
  title: string;
  summary: string;
  severity: Severity;
  rootCause: string;
  remediation: string;
  confidence: number;
}

export interface LogParser {
  parseFile(path: string): Promise<ParsedLogEntry[]>;
}

export interface Analyzer {
  analyze(group: GroupedIncident): Analysis;
}

export interface IncidentRepo {
  init(): void;
  seedUser(email: string, password: string, name: string): Promise<User>;
  findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  findUserById(id: string): Promise<User | null>;
  isEmpty(): Promise<boolean>;
  ingest(fileName: string, groups: GroupedIncident[], analyzer: Analyzer): Promise<void>;
  list(query: IncidentQuery): Promise<{ items: Incident[]; total: number }>;
  detail(id: string): Promise<IncidentDetail | null>;
  updateIncident(id: string, patch: { status?: Status; assigneeId?: string | null; acknowledged?: boolean }, actor: string): Promise<Incident | null>;
  addNote(id: string, body: string, actor: string): Promise<Activity | null>;
  stats(): Promise<Stats>;
  saveJob(job: UploadJob): Promise<void>;
  getJob(id: string): Promise<UploadJob | null>;
}
