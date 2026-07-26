import { createHash } from 'node:crypto';
import type { GroupedIncident, ParsedLogEntry } from '../domain/ports.js';

export function normalize(message: string): string {
  return message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}(:\d+)?/g, '<ip>')
    .replace(/\b[A-Z]{3,}\d{3,}\b/g, '<id>')
    .replace(/\bnull\b/g, '<id>')
    .replace(/\b\d{3,}\b/g, '<n>');
}

export function fingerprint(message: string): string {
  return createHash('sha1').update(normalize(message)).digest('hex').slice(0, 12);
}

export function groupEntries(entries: ParsedLogEntry[]): GroupedIncident[] {
  const buckets: Record<string, ParsedLogEntry[]> = {};
  for (const entry of entries) {
    const key = fingerprint(entry.message);
    buckets[key] = [...(buckets[key] ?? []), entry];
  }

  return Object.entries(buckets)
    .map(([key, members]) => {
      const normalizedCounts = countBy(members.map((entry) => normalize(entry.message)));
      const [normalizedMessage, modalCount] = mode(normalizedCounts);
      const module = mode(countBy(members.map((entry) => entry.module || 'unknown')))[0];
      const modules = unique(members.map((entry) => entry.module || 'unknown')).sort();
      const nonNullCodes = members.map((entry) => entry.code).filter((code): code is string => Boolean(code));
      const code = nonNullCodes.length ? mode(countBy(nonNullCodes))[0] : null;
      const timestamps = members.map((entry) => entry.timestamp).sort();
      return {
        fingerprint: key,
        normalizedMessage,
        message: members.find((entry) => normalize(entry.message) === normalizedMessage)?.message ?? members[0]!.message,
        occurrences: members.length,
        firstSeen: timestamps[0]!,
        lastSeen: timestamps[timestamps.length - 1]!,
        module,
        modules,
        code,
        similarity: modalCount / members.length,
        entries: members,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function mode(counts: Record<string, number>): [string, number] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['', 0];
}

function unique(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
