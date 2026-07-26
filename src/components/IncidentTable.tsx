import { Box, ScrollArea, Table, Text, useMantineColorScheme } from '@mantine/core';
import type { CSSProperties } from 'react';
import type { Incident } from '../api/types';
import { DENSITY, SEVERITY_COLORS } from '../theme/tokens';
import { formatUtcTimestamp } from '../utils/date';
import { SeverityBadge } from './SeverityBadge';
import { StatusPill } from './StatusPill';

export function IncidentTable({
  incidents,
  onSelect,
}: {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
}) {
  const { colorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <Box className="surface">
      <ScrollArea>
        <Table
          horizontalSpacing="sm"
          verticalSpacing={0}
          highlightOnHover={false}
          styles={{
            th: {
              height: 36,
              fontSize: DENSITY.headerFontSize,
              color: 'var(--triage-dim)',
              fontWeight: 600,
              letterSpacing: '0.045em',
              textTransform: 'uppercase',
            },
            td: {
              height: DENSITY.rowHeight,
              fontSize: DENSITY.fontSize,
              borderColor: 'var(--triage-border)',
            },
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th miw={250}>Title</Table.Th>
              <Table.Th miw={360}>Summary</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Occurrences</Table.Th>
              <Table.Th>First seen (UTC)</Table.Th>
              <Table.Th>Last seen (UTC)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {incidents.map((incident) => {
              const isAccent = incident.severity === 'Critical' || incident.severity === 'High';
              return (
                <Table.Tr
                  key={incident.id}
                  className={isAccent ? 'incident-row incident-row--accent' : 'incident-row'}
                  style={
                    isAccent
                      ? { '--severity-accent': SEVERITY_COLORS[incident.severity][scheme] } as CSSProperties
                      : undefined
                  }
                  onClick={() => onSelect(incident)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(incident);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open incident: ${incident.title}`}
                >
                  <Table.Td>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {incident.title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm" lineClamp={1}>
                      {incident.summary}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <SeverityBadge severity={incident.severity} />
                  </Table.Td>
                  <Table.Td>
                    <StatusPill status={incident.status} />
                  </Table.Td>
                  <Table.Td ta="right" className="mono">
                    {incident.occurrences.toLocaleString()}
                  </Table.Td>
                  <Table.Td className="mono">{formatUtcTimestamp(incident.firstSeen)}</Table.Td>
                  <Table.Td className="mono">{formatUtcTimestamp(incident.lastSeen)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
