import { Group, MultiSelect, Select, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { Incident, IncidentQuery, SortField } from '../api/types';
import { SEVERITIES, STATUSES } from '../api/types';
import { toUtcDateKey } from '../utils/date';

type Range = [string | null, string | null];

export function Filters({
  query,
  range,
  modules,
  onQueryChange,
  onRangeChange,
}: {
  query: IncidentQuery;
  range: Range;
  modules: string[];
  onQueryChange: (query: IncidentQuery) => void;
  onRangeChange: (range: Range) => void;
}) {
  const update = (patch: IncidentQuery) => onQueryChange({ ...query, ...patch });

  return (
    <Group gap="xs" align="end" wrap="wrap">
      <TextInput
        label="Search"
        placeholder="Title or summary"
        value={query.q ?? ''}
        onChange={(event) => update({ q: event.currentTarget.value })}
        className="filter-control filter-control--wide"
      />
      <MultiSelect
        label="Severity"
        data={SEVERITIES}
        value={query.severity ?? []}
        onChange={(value) => update({ severity: value as Incident['severity'][] })}
        clearable
        className="filter-control"
      />
      <MultiSelect
        label="Status"
        data={STATUSES}
        value={query.status ?? []}
        onChange={(value) => update({ status: value as Incident['status'][] })}
        clearable
        className="filter-control"
      />
      <Select
        label="Module"
        data={modules}
        value={query.module ?? null}
        onChange={(value) => update({ module: value ?? undefined })}
        clearable
        searchable
        className="filter-control filter-control--wide"
      />
      <DatePickerInput
        type="range"
        label="Last seen (UTC)"
        placeholder="Date range"
        value={range}
        onChange={(value) => {
          onRangeChange(value);
          update({
            from: value[0] ? toUtcDateKey(value[0]) : undefined,
            to: value[1] ? toUtcDateKey(value[1]) : undefined,
          });
        }}
        clearable
        className="filter-control filter-control--wide"
        styles={{ input: { fontFamily: 'var(--triage-mono)' } }}
      />
      <Select
        label="Sort"
        data={[
          { value: 'severity', label: 'Severity' },
          { value: 'occurrences', label: 'Occurrences' },
          { value: 'lastSeen', label: 'Last seen' },
        ]}
        value={query.sort ?? 'severity'}
        onChange={(value) => update({ sort: (value ?? 'severity') as SortField })}
        className="filter-control filter-control--narrow"
      />
    </Group>
  );
}
