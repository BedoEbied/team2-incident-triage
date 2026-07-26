import type { Analysis, Analyzer, GroupedIncident } from '../domain/ports.js';
import type { Severity } from '../domain/types.js';

interface Rule {
  match: RegExp | null;
  severity: Severity;
  title: string;
  summary: string;
  rootCause: string;
  remediation: string;
  confidence: number;
}

const schemaSummary = 'Sequelize is selecting a column the database does not have, so the query aborts. The model definition is ahead of the deployed schema.';
const schemaRoot = 'A model attribute was added in code without a matching migration being run on this database, producing MySQL ER_BAD_FIELD_ERROR (1054).';
const schemaFix = 'Run the pending migrations on this environment, or gate the n' + 'ew attribute behind a schema check. Confirm the model and the deployed table agree before redeploying.';

const rules: Rule[] = [
  {
    match: /access_token/i,
    severity: 'Critical',
    title: 'Sterling auth token missing from integration response',
    summary: 'Every Sterling API call is dereferencing `access_token` on an undefined auth response, so the integration cannot authenticate and all downstream order sync fails.',
    rootCause: 'The Sterling auth endpoint is returning a non-2xx or empty body and the response is used without a guard, so `response.data` is undefined when `access_token` is read.',
    remediation: 'Guard the auth response before dereferencing, log the raw status/body on failure, and verify STERLING_API_PK plus the token endpoint URL are valid for this environment.',
    confidence: 0.94,
  },
  {
    match: /Unknown column '([^']+)' in 'field list'/i,
    severity: 'High',
    title: 'Schema drift: column `{1}` missing from database',
    summary: schemaSummary,
    rootCause: schemaRoot,
    remediation: schemaFix,
    confidence: 0.91,
  },
  {
    match: /A location with locationId .* was not found/i,
    severity: 'Medium',
    title: 'Location lookup failing for unknown or null external IDs',
    summary: 'Scheduling lookups are being issued for location IDs that Sterling does not recognise, including null IDs, so those orders cannot be assigned a location.',
    rootCause: 'Orders carry stale or empty ExternalLocationId values that are passed straight to the scheduling API without validation.',
    remediation: "Skip lookups when the external location ID is null, and reconcile the stored location IDs against Sterling's current location list.",
    confidence: 0.87,
  },
  {
    match: /valid latitude and longitude or searchTerm/i,
    severity: 'Medium',
    title: 'Scheduling search called without coordinates or search term',
    summary: 'The Sterling scheduling search is being invoked with neither coordinates nor a search term, so the request is rejected before any locations are returned.',
    rootCause: 'The location task builds a search request from order address data that is incomplete, and issues it without checking that at least one search key is present.',
    remediation: 'Validate that latitude/longitude or a searchTerm is present before calling the scheduling service, and skip or queue the order when it is not.',
    confidence: 0.89,
  },
  {
    match: /\bconnect ETIMEDOUT\b/i,
    severity: 'High',
    title: 'Connect timeout reaching the Sterling API',
    summary: 'The client could not establish a TCP connection to the Sterling API before the connection deadline, so the request never reached the upstream service.',
    rootCause: 'The TCP connection attempt expired before a socket was established, indicating an unreachable host, blocked egress path, DNS routing issue, or unavailable upstream listener.',
    remediation: 'Verify DNS, egress and firewall connectivity to the Sterling host and port, check upstream availability, and retry connection failures with bounded exponential backoff.',
    confidence: 0.82,
  },
  {
    match: /\bread ETIMEDOUT\b/i,
    severity: 'High',
    title: 'Read timeout waiting for the Sterling API',
    summary: 'The connection to the Sterling API was established, but the upstream response did not arrive before the read deadline.',
    rootCause: 'Sterling accepted the connection but responded too slowly or stopped sending data, which points to upstream latency, overload, or a response timeout set below the operation latency.',
    remediation: 'Measure the affected endpoint latency, inspect Sterling service health, set an operation-appropriate read deadline, and retry only idempotent requests with bounded backoff.',
    confidence: 0.84,
  },
  {
    match: null,
    severity: 'Low',
    title: 'Unclassified application error',
    summary: 'An error was recorded that does not match a known failure pattern.',
    rootCause: 'No rule matched this message. Review the related log entries and stack trace to classify it.',
    remediation: 'Inspect the stack trace, then add a rule or fix for this pattern once the cause is understood.',
    confidence: 0.4,
  },
];

export function createRuleAnalyzer(): Analyzer {
  return {
    analyze(group: GroupedIncident): Analysis {
      const rule = rules.find((item) => item.match?.test(group.normalizedMessage)) ?? rules[rules.length - 1]!;
      const captures = rule.match?.exec(group.normalizedMessage) ?? [];
      return {
        title: interpolate(rule.title, captures),
        summary: interpolate(rule.summary, captures),
        severity: rule.severity,
        rootCause: interpolate(rule.rootCause, captures),
        remediation: interpolate(rule.remediation, captures),
        confidence: rule.confidence,
      };
    },
  };
}

function interpolate(value: string, captures: RegExpExecArray | never[]): string {
  return value.replace(/\{(\d+)}/g, (_, index: string) => captures[Number(index)] ?? '');
}
