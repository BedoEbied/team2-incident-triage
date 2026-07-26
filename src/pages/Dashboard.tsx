import {
  ActionIcon,
  Box,
  Button,
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
import { getIncidents, getStats, USE_MOCK } from '../api/client';
import { getErrorMessage } from '../api/errors';
import type { Incident, IncidentQuery } from '../api/types';
import { AnalyticsRow } from '../components/AnalyticsRow';
import { DetailDrawer } from '../components/DetailDrawer';
import { Filters } from '../components/Filters';
import { IncidentTable } from '../components/IncidentTable';
import { UploadBar } from '../components/UploadBar';
import { CANVAS, DENSITY, FONT_MONO } from '../theme/tokens';

type Range = [string | null, string | null];

function ThemeIcon({ scheme }: { scheme: 'light' | 'dark' }) {
  if (scheme === 'dark') {
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" />
    </svg>
  );
}

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
  const visibleIncidents = incidentsQuery.data?.items ?? [];
  const hasActiveFilters = Boolean(
    query.q?.trim() ||
      query.severity?.length ||
      query.status?.length ||
      query.module ||
      query.from ||
      query.to,
  );

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
                title="Toggle color scheme"
                onClick={() => toggleColorScheme()}
                size="lg"
              >
                <ThemeIcon scheme={scheme} />
              </ActionIcon>
            </Group>
          </Group>

          {statsQuery.isLoading ? (
            <Group className="surface compact-card" role="status" gap="xs">
              <Loader color="gray" size="sm" />
              <Text size="sm">Loading analytics…</Text>
            </Group>
          ) : statsQuery.isError ? (
            <Group className="surface compact-card" role="alert" justify="space-between">
              <Text size="sm">{getErrorMessage(statsQuery.error)}</Text>
              <Button
                variant="default"
                size="xs"
                onClick={() => statsQuery.refetch()}
              >
                Retry analytics
              </Button>
            </Group>
          ) : statsQuery.data && statsQuery.data.total > 0 ? (
            <AnalyticsRow stats={statsQuery.data} />
          ) : (
            <Box className="surface compact-card" role="status">
              <Text size="sm">No analytics data is available.</Text>
            </Box>
          )}

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
              {incidentsQuery.isLoading
                ? 'Loading incident count…'
                : incidentsQuery.isError
                  ? 'Incident count unavailable'
                  : `${visibleIncidents.length} visible ${
                      visibleIncidents.length === 1 ? 'incident' : 'incidents'
                    }`}
            </Text>
            <Text size="xs" c="dimmed" className="mono">
              {USE_MOCK ? 'mock mode' : 'live api'}
            </Text>
          </Group>

          {incidentsQuery.isLoading ? (
            <Group className="surface compact-card" justify="center" py="xl" role="status">
              <Loader color="gray" size="sm" />
              <Text size="sm">Loading incidents…</Text>
            </Group>
          ) : incidentsQuery.isError ? (
            <Group className="surface compact-card" role="alert" justify="space-between">
              <Text size="sm">{getErrorMessage(incidentsQuery.error)}</Text>
              <Button
                variant="default"
                size="xs"
                onClick={() => incidentsQuery.refetch()}
              >
                Retry incidents
              </Button>
            </Group>
          ) : visibleIncidents.length === 0 ? (
            <Box className="surface compact-card" role="status">
              <Text size="sm">
                {hasActiveFilters
                  ? 'No incidents match these filters.'
                  : 'No incidents are available.'}
              </Text>
            </Box>
          ) : (
            <IncidentTable
              incidents={visibleIncidents}
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
