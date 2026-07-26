type FormatUtcDateTimeOptions = {
  seconds?: boolean;
};

export function formatUtcDateTime(
  value: string,
  { seconds = false }: FormatUtcDateTimeOptions = {}
): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: seconds ? '2-digit' : undefined,
    hour12: true,
    timeZone: 'UTC'
  }).format(new Date(value));

  return `${formatted} UTC`;
}
