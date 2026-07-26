import { Grid, Group, Stack, Text, Title, useMantineColorScheme } from '@mantine/core';
import { BarChart, DonutChart, LineChart } from '@mantine/charts';
import type { Stats } from '../api/types';
import { CHART_SERIES, STATUS_COLORS } from '../theme/tokens';

export function AnalyticsRow({ stats }: { stats: Stats }) {
  const { colorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const series = CHART_SERIES(scheme);

  const severityData = Object.entries(stats.bySeverity).map(([name, value], index) => ({
    name,
    value,
    color: series[index],
  }));
  const statusData = Object.entries(stats.byStatus).map(([status, count]) => ({
    status,
    count,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS][scheme],
  }));
  const topData = stats.topIncidents.map((incident, index) => ({
    title: incident.title.replace('Schema drift: ', ''),
    occurrences: incident.occurrences,
    color: series[index % series.length],
  }));

  return (
    <Grid gutter="sm">
      <Grid.Col span={{ base: 12, md: 2 }}>
        <Stack className="surface compact-card" gap={4} h="100%">
          <Text c="dimmed" size="xs" fw={650}>Total incidents</Text>
          <Title order={1} className="mono">{stats.total}</Title>
          <Text c="dimmed" size="xs">893 grouped log entries</Text>
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Stack className="surface compact-card" gap={8}>
          <Text c="dimmed" size="xs" fw={650}>By severity</Text>
          <DonutChart h={150} data={severityData} size={130} thickness={18} withLabels={false} />
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Stack className="surface compact-card" gap={8}>
          <Text c="dimmed" size="xs" fw={650}>By status</Text>
          <BarChart
            h={150}
            data={statusData}
            dataKey="status"
            series={[{ name: 'count', color: STATUS_COLORS.Investigating[scheme] }]}
            withLegend={false}
            tickLine="none"
            gridAxis="none"
          />
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Stack className="surface compact-card" gap={8}>
          <Group justify="space-between">
            <Text c="dimmed" size="xs" fw={650}>Top incident types</Text>
            <Text c="dimmed" size="xs">Occurrences</Text>
          </Group>
          <BarChart
            h={150}
            data={topData}
            dataKey="title"
            series={[{ name: 'occurrences', color: series[0] }]}
            withLegend={false}
            tickLine="none"
            gridAxis="x"
          />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <Stack className="surface compact-card" gap={8}>
          <Text c="dimmed" size="xs" fw={650}>Trend</Text>
          <LineChart
            h={150}
            data={stats.trend}
            dataKey="date"
            series={[{ name: 'count', color: series[1] }]}
            curveType="linear"
            withLegend={false}
            tickLine="none"
            gridAxis="xy"
          />
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
