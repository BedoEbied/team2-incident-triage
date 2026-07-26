import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Appbar, Button, FAB, List, Snackbar, Text, TextInput, SegmentedButtons, useTheme } from 'react-native-paper';
import { apiClient } from '@/api/client';
import type { Status } from '@/api/types';
import { STATUSES } from '@/api/types';
import { useAuth } from '@/features/auth/AuthContext';
import { CANVAS, DENSITY, RADIUS } from '@/theme/tokens';
import { FONT_MONO_NATIVE } from '@/theme/fonts';
import { SeverityChip, StatusChip } from './chips';
import { formatUtcDateTime } from './format';

type IncidentDetailScreenProps = {
  id: string;
};

export function IncidentDetailScreen({ id }: IncidentDetailScreenProps) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [snackbar, setSnackbar] = useState('');

  const detailQuery = useQuery({
    queryKey: ['incident', id, token],
    queryFn: () => apiClient.getIncident(id, token)
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['incident', id, token] });
    await queryClient.invalidateQueries({ queryKey: ['incidents'] });
  };

  const patchMutation = useMutation({
    mutationFn: (patch: { status?: Status; assigneeId?: string; acknowledged?: boolean }) =>
      apiClient.patchIncident(id, patch, token),
    onSuccess: async () => {
      await invalidate();
      setSnackbar('Incident updated');
    }
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => apiClient.addNote(id, body, token),
    onSuccess: async () => {
      setNote('');
      await invalidate();
      setSnackbar('Note added');
    }
  });

  const incident = detailQuery.data;

  return (
    <View style={[styles.screen, { backgroundColor: canvas.page }]}>
      <Appbar.Header mode="small" elevated={false} style={[styles.appbar, { backgroundColor: canvas.surface, borderBottomColor: canvas.border }]}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title="Incident detail"
          titleStyle={[styles.appbarTitle, { color: canvas.text, fontFamily: theme.fonts.titleLarge.fontFamily }]}
        />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        {!incident ? (
          <Text style={{ color: canvas.textDim }}>{detailQuery.isLoading ? 'Loading incident...' : 'Incident unavailable'}</Text>
        ) : (
          <>
            <View style={[styles.panel, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
              <Text
                style={[
                  styles.title,
                  { color: canvas.text, fontFamily: theme.fonts.headlineSmall.fontFamily }
                ]}
              >
                {incident.title}
              </Text>
              <View style={styles.chips}>
                <SeverityChip severity={incident.severity} />
                <StatusChip status={incident.status} />
                <Text style={[styles.count, { color: canvas.textDim }]}>{incident.occurrences} occurrences</Text>
              </View>
              <Text style={[styles.summary, { color: canvas.text }]}>{incident.summary}</Text>
              <Text style={[styles.explanation, { color: canvas.textDim }]}>
                Confidence {Math.round(incident.confidence * 100)}% from {Math.round(incident.similarity * 100)}% similar log entries.
              </Text>
            </View>

            <List.Section style={styles.section}>
              <Field title="Root cause" body={incident.rootCause} />
              <Field title="Suggested remediation" body={incident.remediation} />
              <Field title="Module" body={incident.module} mono />
              <Field title="First seen (UTC)" body={formatUtcDateTime(incident.firstSeen, { seconds: true })} mono />
              <Field title="Last seen (UTC)" body={formatUtcDateTime(incident.lastSeen, { seconds: true })} mono />
            </List.Section>

            <Text style={[styles.label, { color: canvas.textDim }]}>Status</Text>
            <SegmentedButtons
              value={incident.status}
              onValueChange={(value) => patchMutation.mutate({ status: value as Status })}
              buttons={STATUSES.map((item) => ({ value: item, label: item }))}
              density="small"
              style={styles.segment}
            />
            <View style={styles.actions}>
              <Button
                compact
                mode="outlined"
                onPress={() => patchMutation.mutate({ acknowledged: !incident.acknowledged })}
                style={styles.actionButton}
              >
                {incident.acknowledged ? 'Unacknowledge' : 'Acknowledge'}
              </Button>
              <Button
                compact
                mode="outlined"
                onPress={() => patchMutation.mutate({ assigneeId: 'u_1' })}
                style={styles.actionButton}
              >
                Assign to me
              </Button>
            </View>

            <View style={[styles.panel, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
              <Text style={[styles.label, { color: canvas.textDim }]}>Add note</Text>
              <TextInput
                mode="outlined"
                dense
                multiline
                value={note}
                onChangeText={setNote}
                placeholder="Record what changed or what to check next"
                style={styles.note}
              />
              <Button
                compact
                mode="contained"
                disabled={!note.trim() || noteMutation.isPending}
                loading={noteMutation.isPending}
                onPress={() => noteMutation.mutate(note.trim())}
                style={styles.actionButton}
              >
                Add note
              </Button>
            </View>

            <View style={[styles.panel, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
              <Text style={[styles.label, { color: canvas.textDim }]}>Related log entries</Text>
              {incident.entries.map((entry) => (
                <View key={entry.id} style={[styles.logBlock, { borderColor: canvas.border }]}>
                  <Text style={[styles.mono, { color: canvas.textDim }]}>
                    {formatUtcDateTime(entry.timestamp, { seconds: true })} {entry.level} {entry.code ?? ''}
                  </Text>
                  <Text style={[styles.mono, { color: canvas.text }]}>{entry.message}</Text>
                  <Text style={[styles.monoDim, { color: canvas.textDim }]}>{entry.module}</Text>
                  {entry.stack ? <Text style={[styles.monoDim, { color: canvas.textDim }]}>{entry.stack}</Text> : null}
                </View>
              ))}
            </View>

            <View style={[styles.panel, { backgroundColor: canvas.surface, borderColor: canvas.border }]}>
              <Text style={[styles.label, { color: canvas.textDim }]}>History</Text>
              {incident.history.map((activity) => (
                <View key={activity.id} style={[styles.historyItem, { borderBottomColor: canvas.border }]}>
                  <Text style={[styles.historyTitle, { color: canvas.text }]}>
                    {activity.actor} · {activity.type}
                  </Text>
                  <Text style={[styles.monoDim, { color: canvas.textDim }]}>
                    {formatUtcDateTime(activity.at, { seconds: true })}
                  </Text>
                  <Text style={[styles.historyBody, { color: canvas.textDim }]}>
                    {activity.body ?? [activity.from, activity.to].filter(Boolean).join(' → ')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {incident ? (
        <FAB
          icon="account-arrow-left"
          label="Assign"
          onPress={() => patchMutation.mutate({ assigneeId: 'u_1' })}
          style={[styles.fab, { backgroundColor: canvas.surface, borderColor: canvas.border }]}
          color={canvas.text}
        />
      ) : null}
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

function Field({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];
  return (
    <List.Item
      title={title}
      description={body}
      titleStyle={[styles.fieldTitle, { color: canvas.textDim }]}
      descriptionStyle={[styles.fieldBody, mono ? styles.mono : undefined, { color: canvas.text }]}
      style={[styles.field, { backgroundColor: canvas.surface, borderColor: canvas.border }]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appbar: { borderBottomWidth: 1 },
  appbarTitle: { fontSize: 20, fontWeight: '400' },
  content: { padding: 12, paddingBottom: 88 },
  panel: { borderRadius: RADIUS.panel, borderWidth: 1, marginBottom: 10, padding: 10 },
  title: { fontSize: 27, fontWeight: '400', lineHeight: 31 },
  chips: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  count: { flex: 1, fontSize: 12, textAlign: 'right' },
  summary: { fontSize: 14, lineHeight: 19, marginTop: 10 },
  explanation: { fontSize: DENSITY.fontSize, lineHeight: 18, marginTop: 8 },
  section: { marginBottom: 4, marginTop: 0 },
  field: { borderRadius: RADIUS.control, borderWidth: 1, marginBottom: 6, paddingVertical: 0 },
  fieldTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  fieldBody: { fontSize: DENSITY.fontSize, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  segment: { borderRadius: RADIUS.control, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionButton: { borderRadius: RADIUS.control, flex: 1 },
  note: { fontSize: DENSITY.fontSize, marginBottom: 8, minHeight: 72 },
  logBlock: { borderTopWidth: 1, gap: 4, paddingVertical: 8 },
  mono: { fontFamily: FONT_MONO_NATIVE, fontSize: 12, lineHeight: 16 },
  monoDim: { fontFamily: FONT_MONO_NATIVE, fontSize: 11, lineHeight: 15 },
  historyItem: { borderBottomWidth: 1, paddingVertical: 8 },
  historyTitle: { fontSize: DENSITY.fontSize, fontWeight: '600' },
  historyBody: { fontSize: DENSITY.fontSize, lineHeight: 18, marginTop: 2 },
  fab: { borderRadius: RADIUS.control, borderWidth: 1, bottom: 18, position: 'absolute', right: 16 }
});
