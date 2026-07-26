import {
  ActionIcon,
  Box,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { getIncidents, getStats } from '../api/client';
import type { Incident, IncidentQuery } from '../api/types';
import { AnalyticsRow } from '../components/AnalyticsRow';
import { DetailDrawer } from '../components/DetailDrawer';
import { Filters } from '../components/Filters';
import { IncidentTable } from '../components/IncidentTable';
import { UploadBar } from '../components/UploadBar';
import { CANVAS, DENSITY, FONT_MONO } from '../theme/tokens';

type Range = [string | null, string | null];

export function Dashboard() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  const [query, setQuery] = useState<IncidentQuery>({ sort: 'severity', order: 'desc' });
  const [range, setRange] = useState<Range>([null, null]);
  const [selected, setSelected] = useState<Incident | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ['incidents', query],
    queryFn: () => getIncidents(query),
  });
  const allIncidentsQuery = useQuery({
    queryKey: ['incidents', 'modules'],
    queryFn: () => getIncidents({ sort: 'severity', order: 'desc' }),
  });
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const modules = useMemo(() => {
    const values = allIncidentsQuery.data?.items.map((incident) => incident.module) ?? [];
    return Array.from(new Set(values)).sort();
  }, [allIncidentsQuery.data]);

  return (
    <Box
      className="app-shell"
      style={{
        '--triage-page': canvas.page,
        '--triage-surface': canvas.surface,
        '--triage-border': canvas.border,
        '--triage-text': canvas.text,
        '--triage-dim': canvas.textDim,
        '--triage-accent-row': canvas.accentRow,
        '--triage-mono': FONT_MONO,
      } as CSSProperties}
    >
      <Container size="xl" py={DENSITY.sectionGap}>
        <Stack gap={DENSITY.sectionGap}>
          <Group justify="space-between" align="start">
            <Stack gap={2}>
              <Title order={1}>Incident Triage</Title>
              <Text size="xs" c="dimmed">AI grouped logs for on-call response</Text>
            </Stack>
            <Group align="start" gap="sm">
              <UploadBar />
              <ActionIcon
                variant="default"
                aria-label="Toggle color scheme"
                onClick={() => toggleColorScheme()}
                size="lg"
              >
                {scheme === 'dark' ? 'L' : 'D'}
              </ActionIcon>
            </Group>
          </Group>

          {statsQuery.data && <AnalyticsRow stats={statsQuery.data} />}

          <Box className="surface compact-card">
            <Filters
              query={query}
              range={range}
              modules={modules}
              onQueryChange={setQuery}
              onRangeChange={setRange}
            />
          </Box>

          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {incidentsQuery.data?.total ?? 0} visible incidents
            </Text>
            <Text size="xs" c="dimmed" className="mono">
              mock mode
            </Text>
          </Group>

          {incidentsQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="gray" />
            </Group>
          ) : (
            <IncidentTable
              incidents={incidentsQuery.data?.items ?? []}
              onSelect={(incident) => setSelected(incident)}
            />
          )}
        </Stack>
      </Container>

      <DetailDrawer
        incident={selected}
        opened={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </Box>
  );
}
