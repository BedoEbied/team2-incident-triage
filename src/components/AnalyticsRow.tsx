import { Grid, Group, Stack, Text, Title, useMantineColorScheme } from '@mantine/core';
import { BarChart, DonutChart, LineChart } from '@mantine/charts';
import type { Stats } from '../api/types';
import { CHART_SERIES, FONT_MONO, STATUS_COLORS } from '../theme/tokens';
import { formatUtcDateLabel } from '../utils/date';
import { buildTopIncidentChartData } from './analyticsData';

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
  }));
  const topData = buildTopIncidentChartData(stats.topIncidents);
  const topIncidentTitles = new Map(topData.map(({ id, title }) => [id, title]));
  const trendData = stats.trend.map((bucket) => ({
    ...bucket,
    date: formatUtcDateLabel(bucket.date),
  }));

  return (
    <Grid gutter="sm">
      <Grid.Col span={{ base: 12, md: 2 }}>
        <Stack className="surface compact-card" gap={4} h="100%">
          <Text c="dimmed" size="xs" fw={650}>Total incidents</Text>
          <Title order={1} className="mono">{stats.total}</Title>
          <Text c="dimmed" size="xs">Grouped from uploaded logs</Text>
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
            dataKey="id"
            series={[{ name: 'occurrences', color: series[0] }]}
            withLegend={false}
            tickLine="none"
            gridAxis="x"
            xAxisProps={{
              tickFormatter: (id: string) => topIncidentTitles.get(id) ?? id,
            }}
            tooltipProps={{
              labelFormatter: (id) => topIncidentTitles.get(String(id)) ?? id,
            }}
          />
        </Stack>
      </Grid.Col>
      <Grid.Col span={12}>
        <Stack className="surface compact-card" gap={8}>
          <Text c="dimmed" size="xs" fw={650}>Trend by UTC date</Text>
          <LineChart
            h={150}
            data={trendData}
            dataKey="date"
            series={[{ name: 'count', color: series[1] }]}
            curveType="linear"
            withLegend={false}
            tickLine="none"
            gridAxis="xy"
            xAxisProps={{
              tick: { fontFamily: FONT_MONO },
            }}
          />
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
