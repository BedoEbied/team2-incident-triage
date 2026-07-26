import { Box, ScrollArea, Table, Text, useMantineColorScheme } from '@mantine/core';
import type { CSSProperties } from 'react';
import type { Incident } from '../api/types';
import { SEVERITY_COLORS } from '../theme/tokens';
import { SeverityBadge } from './SeverityBadge';
import { StatusPill } from './StatusPill';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

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
            th: { height: 34, fontSize: 12, color: 'var(--triage-dim)', fontWeight: 650 },
            td: { height: 38, fontSize: 13, borderColor: 'var(--triage-border)' },
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th miw={250}>Title</Table.Th>
              <Table.Th miw={360}>Summary</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Occurrences</Table.Th>
              <Table.Th>First seen</Table.Th>
              <Table.Th>Last seen</Table.Th>
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
                  <Table.Td className="mono">{formatDate(incident.firstSeen)}</Table.Td>
                  <Table.Td className="mono">{formatDate(incident.lastSeen)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
