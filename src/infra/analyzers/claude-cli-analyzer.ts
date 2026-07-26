import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Analysis, Analyzer, GroupedIncident } from '../../domain/ports.js';
import {
  SYSTEM_PROMPT,
  type AnalysisCache,
  buildUserPrompt,
  createFileAnalysisCache,
  validateAnalysis,
  withTimeoutRetry,
} from './shared.js';

type ClaudeRunner = (
  binary: string,
  args: string[],
  prompt: string,
  signal: AbortSignal,
) => Promise<string>;

interface ClaudeAnalyzerOptions {
  resolveBinary?: (path: string) => string | null;
  run?: ClaudeRunner;
  cache?: AnalysisCache;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export function createClaudeCliAnalyzer(
  env: NodeJS.ProcessEnv = process.env,
  options: ClaudeAnalyzerOptions = {},
): Analyzer | null {
  const binary = (options.resolveBinary ?? resolveClaudeBinary)(env.PATH ?? '');
  if (!binary) return null;

  const run = options.run ?? runClaude;
  const cache = options.cache ?? createFileAnalysisCache('data/analysis-cache.json');
  const args = ['-p', '--output-format', 'json'];

  return {
    async analyze(group: GroupedIncident): Promise<Analysis> {
      const key = `claude-cli:${group.fingerprint}:v1`;
      const hit = cache.get(key);
      if (hit) return hit;

      const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(group)}\n\n`
        + 'Return only a JSON object with title, summary, severity, rootCause, remediation, and confidence.';
      const analysis = await withTimeoutRetry(
        async (signal) => {
          const raw = await run(binary, args, prompt, signal);
          const parsed = validateAnalysis(extractJson(raw));
          if (!parsed) throw Reflect.construct(Error, ['Claude CLI response failed validation']) as Error;
          return parsed;
        },
        options.timeoutMs,
        options.retryDelayMs,
      );

      await cache.set(key, analysis);
      return analysis;
    },
  };
}

export function resolveClaudeBinary(pathEnv: string): string | null {
  for (const directory of pathEnv.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, 'claude');
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue through PATH entries.
    }
  }
  return null;
}

function runClaude(
  binary: string,
  args: string[],
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      shell: false,
    });
    const outputLimit = 64 * 1024;
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (error: Error | null, output?: string) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(output ?? '');
    };
    const onAbort = () => {
      child.kill('SIGKILL');
      finish(Reflect.construct(Error, ['Claude CLI timed out']) as Error);
    };
    signal.addEventListener('abort', onAbort, { once: true });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = appendBounded(stdout, chunk, outputLimit);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = appendBounded(stderr, chunk, outputLimit);
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (code !== 0) {
        finish(Reflect.construct(
          Error,
          [`Claude CLI exited ${code}: ${stderr.slice(0, 200)}`],
        ) as Error);
        return;
      }
      finish(null, stdout);
    });

    child.stdin.end(prompt, 'utf8');
  });
}

function appendBounded(existing: string, chunk: string, limit: number): string {
  if (existing.length >= limit) return existing;
  return `${existing}${chunk}`.slice(0, limit);
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    const envelope = JSON.parse(trimmed) as { result?: unknown; content?: unknown };
    if (typeof envelope.result === 'string') return JSON.parse(unwrapJson(envelope.result)) as unknown;
    if (typeof envelope.content === 'string') return JSON.parse(unwrapJson(envelope.content)) as unknown;
    return envelope;
  } catch {
    return JSON.parse(unwrapJson(trimmed)) as unknown;
  }
}

function unwrapJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
