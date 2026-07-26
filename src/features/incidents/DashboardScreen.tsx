import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Appbar, Searchbar, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { apiClient } from '@/api/client';
import { SEVERITIES, STATUSES, type Incident, type Severity, type SortField, type Status } from '@/api/types';
import { cacheIncidentList, readCachedIncidentList } from '@/storage/cache';
import { useAuth } from '@/features/auth/AuthContext';
import { CANVAS, DENSITY, RADIUS } from '@/theme/tokens';
import { IncidentCard } from './IncidentCard';
import { startIncidentPolling } from '@/notify/poll';

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

  const incidentsQuery = useQuery({
    queryKey: ['incidents', query, severity, status, sort, token],
    queryFn: async () => {
      try {
        const response = await apiClient.listIncidents(
          {
            q: query,
            severity: severity === 'All' ? undefined : [severity],
            status: status === 'All' ? undefined : [status],
            sort,
            order: 'desc'
          },
          token
        );
        await cacheIncidentList(response.items);
        return { items: response.items, offline: false };
      } catch (error) {
        const cached = await readCachedIncidentList();
        return { items: cached, offline: true };
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
        <Appbar.Content title="Active incidents" titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="logout" onPress={logout} />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={incidentsQuery.isFetching} onRefresh={() => incidentsQuery.refetch()} />}
      >
        <View style={styles.tiles}>
          <SummaryTile label="Active" value={totals.total} />
          <SummaryTile label="Critical" value={totals.critical} />
          <SummaryTile label="High" value={totals.high} />
          <SummaryTile label="Investigating" value={totals.investigating} />
        </View>
        {incidentsQuery.data?.offline ? (
          <Text style={[styles.offline, { color: canvas.textDim }]}>Showing cached incidents</Text>
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
          {items.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  return (
    <View style={[styles.tile, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
      <Text style={[styles.tileValue, { color: canvas.text }]}>{value}</Text>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: canvas.textDim }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appbar: { borderBottomWidth: 1 },
  appbarTitle: { fontSize: 15, fontWeight: '700' },
  content: { padding: 12, paddingBottom: 28 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { borderRadius: RADIUS, borderWidth: 1, flex: 1, minHeight: 58, paddingHorizontal: 8, paddingVertical: 8 },
  tileValue: { fontSize: 20, fontWeight: '800', lineHeight: 23 },
  tileLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  offline: { fontSize: DENSITY.fontSize, marginTop: 8 },
  search: { borderRadius: RADIUS, borderWidth: 1, height: 42, marginTop: 10 },
  searchInput: { fontSize: DENSITY.fontSize, minHeight: 42 },
  filterLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  segment: { borderRadius: RADIUS },
  list: { marginTop: 12 }
});
