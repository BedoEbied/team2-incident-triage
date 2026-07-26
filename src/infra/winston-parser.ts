import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import type { LogParser, ParsedLogEntry } from '../domain/ports.js';

export function createWinstonParser(): LogParser {
  return { parseFile };
}

async function parseFile(path: string): Promise<ParsedLogEntry[]> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  const entries: ParsedLogEntry[] = [];
  let block: string[] = [];
  let inBlock = false;

  for await (const line of rl) {
    if (line === '{') {
      inBlock = true;
      block = [line];
      continue;
    }
    if (!inBlock) continue;
    block.push(line);
    if (line === '}') {
      const parsed = parseBlock(block);
      if (parsed) entries.push(parsed);
      inBlock = false;
      block = [];
    }
  }

  return entries;
}

function parseBlock(lines: string[]): ParsedLogEntry | null {
  const fields: Record<string, string> = {};
  for (let i = 1; i < lines.length - 1; i += 1) {
    const line = lines[i]!;
    const keyMatch = /^  ([A-Za-z_]\w*): (.*)$/.exec(line);
    if (!keyMatch) continue;
    const [, key, raw] = keyMatch;
    if (!key || !raw) continue;

    if (key === 'message' && raw.trim() === '{') {
      const nested = parseNested(lines, i + 1);
      fields.stack = nested.values.stack || fields.stack;
      fields.message = nested.values.message || nested.values.error || firstStackLine(nested.values.stack) || '';
      if (nested.values.code) fields.code = nested.values.code;
      i = nested.end;
      continue;
    }

    const quoted = parseQuotedValue(lines, i);
    if (quoted) {
      fields[key] = quoted.value;
      i = quoted.end;
    }
  }

  const message = fields.message || fields.error;
  const timestamp = fields.timestamp;
  if (!message || !timestamp) return null;
  const frame = extractModule(fields.stack ?? '');
  return {
    timestamp: toIsoUtc(timestamp),
    level: fields.level ?? 'error',
    message,
    code: fields.code ?? null,
    module: frame.module,
    symbol: frame.symbol,
    stack: fields.stack ?? '',
  };
}

function parseNested(lines: string[], start: number): { values: Record<string, string>; end: number } {
  const out: { values: Record<string, string>; end: number } = { values: {}, end: start };
  for (let i = start; i < lines.length; i += 1) {
    if (/^  },?$/.test(lines[i]!)) {
      out.end = i;
      return out;
    }
    const match = /^    ([A-Za-z_]\w*): (.*)$/.exec(lines[i]!);
    if (!match) continue;
    const [, key] = match;
    const quoted = parseQuotedValue(lines, i);
    if (key && quoted) {
      out.values[key] = quoted.value;
      i = quoted.end;
    }
  }
  return out;
}

function parseQuotedValue(lines: string[], start: number): { value: string; end: number } | null {
  const values: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const segment = parseSegment(lines[i]!);
    if (!segment) return values.length ? { value: values.join('').replace(/\\n/g, '\n'), end: i - 1 } : null;
    values.push(segment.text);
    if (!segment.continues) return { value: values.join('').replace(/\\n/g, '\n'), end: i };
  }
  return null;
}

function parseSegment(line: string): { text: string; continues: boolean } | null {
  const keyed = /^\s*[A-Za-z_]\w*:/.test(line);
  const colon = keyed ? line.indexOf(':') : -1;
  const source = colon >= 0 ? line.slice(colon + 1).trim() : line.trim();
  const quote = source[0];
  if (quote !== '\'' && quote !== '"') return null;
  let text = '';
  for (let i = 1; i < source.length; i += 1) {
    const char = source[i]!;
    if (char === quote && source[i - 1] !== '\\') {
      const tail = source.slice(i + 1).trim();
      return { text, continues: /^\+[,]?$/.test(tail) || /^\+,?$/.test(tail) };
    }
    text += char;
  }
  return null;
}

function toIsoUtc(timestamp: string): string {
  return `${timestamp.replace(' ', 'T')}.000Z`;
}

function extractModule(stack: string): { module: string; symbol: string } {
  for (const line of stack.split('\n')) {
    if (!line.includes('/src/') || line.includes('node_modules')) continue;
    const match = /^\s*at\s+(.+?)\s+\((.+\/src\/.+?):\d+:\d+\)/.exec(line) ?? /^\s*at\s+(.+\/src\/.+?):\d+:\d+/.exec(line);
    if (!match) continue;
    if (match.length === 3) return { symbol: match[1]!, module: `src/${match[2]!.split('/src/')[1]!}` };
    return { symbol: '', module: `src/${match[1]!.split('/src/')[1]!}` };
  }
  return { module: 'unknown', symbol: '' };
}

function firstStackLine(stack: string | undefined): string {
  return (stack ?? '').split('\n')[0]?.trim() ?? '';
}
