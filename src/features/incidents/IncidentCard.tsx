import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import type { Incident } from '@/api/types';
import { CANVAS, DENSITY, RADIUS, SEVERITY_COLORS } from '@/theme/tokens';
import { formatDateTime } from './format';
import { SeverityChip, StatusChip } from './chips';

type IncidentCardProps = {
  incident: Incident;
  onPress(): void;
};

export function IncidentCard({ incident, onPress }: IncidentCardProps) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  const accent = incident.severity === 'Critical' || incident.severity === 'High'
    ? SEVERITY_COLORS[incident.severity][scheme]
    : canvas.border;

  return (
    <Pressable onPress={onPress}>
      <Card mode="outlined" style={[styles.card, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <Card.Content style={styles.content}>
          <View style={styles.header}>
            <Text numberOfLines={2} style={[styles.title, { color: canvas.text }]}>
              {incident.title}
            </Text>
            <Text style={[styles.count, { color: canvas.text }]}>
              {incident.occurrences}
            </Text>
          </View>
          <Text numberOfLines={2} style={[styles.summary, { color: canvas.textDim }]}>
            {incident.summary}
          </Text>
          <View style={styles.meta}>
            <SeverityChip severity={incident.severity} />
            <StatusChip status={incident.status} />
            <Text numberOfLines={1} style={[styles.timestamp, { color: canvas.textDim }]}>
              {formatDateTime(incident.lastSeen)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8, borderRadius: RADIUS, overflow: 'hidden' },
  accent: { bottom: 0, left: 0, position: 'absolute', top: 0, width: 3 },
  content: { gap: 6, paddingBottom: 10, paddingLeft: 12, paddingRight: 10, paddingTop: 10 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  count: { fontSize: 17, fontWeight: '800', lineHeight: 20 },
  summary: { fontSize: DENSITY.fontSize, lineHeight: 17 },
  meta: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  timestamp: { flex: 1, fontFamily: 'Courier', fontSize: 12, textAlign: 'right' }
});
