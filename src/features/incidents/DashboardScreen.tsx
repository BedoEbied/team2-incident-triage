import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Appbar, Button, Searchbar, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { apiClient } from '@/api/client';
import { SEVERITIES, STATUSES, type IncidentQuery, type Severity, type SortField, type Status } from '@/api/types';
import { cacheIncidentList, readCachedIncidentList } from '@/storage/cache';
import { useAuth } from '@/features/auth/AuthContext';
import { BRAND, CANVAS, DENSITY, RADIUS } from '@/theme/tokens';
import { IncidentCard } from './IncidentCard';
import { startIncidentPolling } from '@/notify/poll';
import { applyIncidentQuery } from './query';

type SeverityFilter = 'All' | Severity;
type StatusFilter = 'All' | Status;

export function DashboardScreen() {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  const { token, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('All');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [sort, setSort] = useState<SortField>('severity');
  const incidentQuery = useMemo<IncidentQuery>(
    () => ({
      q: query,
      severity: severity === 'All' ? undefined : [severity],
      status: status === 'All' ? undefined : [status],
      sort,
      order: 'desc'
    }),
    [query, severity, sort, status]
  );
  const hasFilters = Boolean(query.trim() || severity !== 'All' || status !== 'All');

  const incidentsQuery = useQuery({
    queryKey: ['incidents', query, severity, status, sort, token],
    queryFn: async () => {
      try {
        const response = await apiClient.listIncidents(incidentQuery, token);
        if (!hasFilters) {
          await cacheIncidentList(response.items);
        }
        return { items: response.items, requestFailed: false, warning: '' };
      } catch (error) {
        const cached = await readCachedIncidentList();
        const warning = error instanceof Error ? error.message : 'Unable to refresh incidents';
        return {
          items: applyIncidentQuery(cached, incidentQuery),
          requestFailed: true,
          warning
        };
      }
    }
  });

  useEffect(() => startIncidentPolling(token), [token]);

  const items = incidentsQuery.data?.items ?? [];
  const totals = useMemo(
    () => ({
      total: items.length,
      critical: items.filter((incident) => incident.severity === 'Critical').length,
      high: items.filter((incident) => incident.severity === 'High').length,
      investigating: items.filter((incident) => incident.status === 'Investigating').length
    }),
    [items]
  );

  return (
    <View style={[styles.screen, { backgroundColor: canvas.page }]}>
      <Appbar.Header mode="small" elevated={false} style={[styles.appbar, { backgroundColor: canvas.surface, borderBottomColor: canvas.border }]}>
        <View style={[styles.brandMark, { backgroundColor: BRAND.lime }]} />
        <Appbar.Content
          title="Active incidents"
          titleStyle={[styles.appbarTitle, { color: canvas.text, fontFamily: theme.fonts.titleLarge.fontFamily }]}
        />
        <Appbar.Action icon="logout" onPress={logout} />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={incidentsQuery.isRefetching} onRefresh={() => incidentsQuery.refetch()} />}
      >
        <View style={styles.tiles}>
          <SummaryTile label="Active" value={totals.total} />
          <SummaryTile label="Critical" value={totals.critical} />
          <SummaryTile label="High" value={totals.high} />
          <SummaryTile label="Investigating" value={totals.investigating} />
        </View>
        {incidentsQuery.data?.requestFailed && items.length > 0 ? (
          <Text style={[styles.warning, { color: theme.colors.error }]}>
            Refresh failed — showing cached incidents. {incidentsQuery.data.warning}
          </Text>
        ) : null}
        <Searchbar
          value={query}
          onChangeText={setQuery}
          placeholder="Search title or summary"
          style={[styles.search, { backgroundColor: canvas.surface, borderColor: canvas.border }]}
          inputStyle={styles.searchInput}
          elevation={0}
        />
        <Text style={[styles.filterLabel, { color: canvas.textDim }]}>Severity</Text>
        <SegmentedButtons
          value={severity}
          onValueChange={(value) => setSeverity(value as SeverityFilter)}
          buttons={[{ value: 'All', label: 'All' }, ...SEVERITIES.map((item) => ({ value: item, label: item }))]}
          density="small"
          style={styles.segment}
        />
        <Text style={[styles.filterLabel, { color: canvas.textDim }]}>Status</Text>
        <SegmentedButtons
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          buttons={[{ value: 'All', label: 'All' }, ...STATUSES.map((item) => ({ value: item, label: item }))]}
          density="small"
          style={styles.segment}
        />
        <Text style={[styles.filterLabel, { color: canvas.textDim }]}>Sort</Text>
        <SegmentedButtons
          value={sort}
          onValueChange={(value) => setSort(value as SortField)}
          buttons={[
            { value: 'severity', label: 'Severity' },
            { value: 'lastSeen', label: 'Last seen' },
            { value: 'occurrences', label: 'Count' }
          ]}
          density="small"
          style={styles.segment}
        />
        <View style={styles.list}>
          {incidentsQuery.isPending ? (
            <ListState
              title="Loading incidents…"
              body="Fetching the current triage queue."
            />
          ) : incidentsQuery.data?.requestFailed && items.length === 0 ? (
            <ListState
              title="Request failed"
              body={incidentsQuery.data.warning}
              error
              onRetry={() => incidentsQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <ListState
              title="No incidents match these filters"
              body="Clear a filter or change the search to restore the queue."
            />
          ) : (
            items.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ListState({
  title,
  body,
  error = false,
  onRetry
}: {
  title: string;
  body: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];

  return (
    <View style={[styles.listState, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
      <Text style={[styles.listStateTitle, { color: error ? theme.colors.error : canvas.text }]}>
        {title}
      </Text>
      <Text style={[styles.listStateBody, { color: canvas.textDim }]}>{body}</Text>
      {onRetry ? (
        <Button compact mode="outlined" onPress={onRetry} style={styles.retryButton}>
          Try again
        </Button>
      ) : null}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  return (
    <View style={[styles.tile, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
      <Text
        style={[
          styles.tileValue,
          { color: canvas.text, fontFamily: theme.fonts.displayLarge.fontFamily }
        ]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: canvas.textDim }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appbar: { borderBottomWidth: 1 },
  brandMark: { borderRadius: 2, height: 9, marginLeft: 16, width: 9 },
  appbarTitle: { fontSize: 20, fontWeight: '400' },
  content: { padding: 12, paddingBottom: 28 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { borderRadius: RADIUS.control, borderWidth: 1, flex: 1, minHeight: 72, paddingHorizontal: 8, paddingVertical: 7 },
  tileValue: { fontSize: DENSITY.statSize, fontWeight: '400', lineHeight: 41 },
  tileLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  warning: { fontSize: DENSITY.fontSize, lineHeight: 18, marginTop: 8 },
  search: { borderRadius: RADIUS.control, borderWidth: 1, height: 42, marginTop: 10 },
  searchInput: { fontSize: DENSITY.fontSize, minHeight: 42 },
  filterLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  segment: { borderRadius: RADIUS.control },
  list: { marginTop: 12 },
  listState: { borderRadius: RADIUS.panel, borderWidth: 1, padding: 16 },
  listStateTitle: { fontSize: 16, fontWeight: '600' },
  listStateBody: { fontSize: DENSITY.fontSize, lineHeight: 18, marginTop: 4 },
  retryButton: { alignSelf: 'flex-start', borderRadius: RADIUS.control, marginTop: 10 }
});
