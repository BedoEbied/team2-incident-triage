const UTC = 'UTC';

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: UTC,
});

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  timeZone: UTC,
});

function asUtcDate(value: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
}

export function formatUtcTimestamp(value: string) {
  return `${timestampFormatter.format(asUtcDate(value))} UTC`;
}

export function formatUtcDateLabel(value: string) {
  return dateLabelFormatter.format(asUtcDate(value));
}

export function toUtcDateKey(value: string) {
  return asUtcDate(value).toISOString().slice(0, 10);
}
