import {
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { addNote, getIncident, patchIncident } from '../api/client';
import { getErrorMessage } from '../api/errors';
import type { Incident, Status } from '../api/types';
import { STATUSES } from '../api/types';
import { FONT_MONO } from '../theme/tokens';
import { formatUtcTimestamp } from '../utils/date';
import { SeverityBadge } from './SeverityBadge';
import { StatusPill } from './StatusPill';

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DetailDrawer({
  incident,
  opened,
  onClose,
}: {
  incident: Incident | null;
  opened: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['incident', incident?.id],
    queryFn: () => getIncident(incident!.id),
    enabled: Boolean(incident?.id && opened),
  });

  const statusMutation = useMutation({
    mutationFn: (status: Status) => patchIncident(incident!.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incident?.id] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => addNote(incident!.id, body),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['incident', incident?.id] });
    },
  });

  const detail = detailQuery.data;

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="xl" title="Incident detail">
      {!incident && (
        <Text size="sm" role="status">No incident is selected.</Text>
      )}
      {incident && detailQuery.isLoading && (
        <Group justify="center" py="xl" role="status">
          <Loader color="gray" size="sm" />
          <Text size="sm">Loading incident details…</Text>
        </Group>
      )}
      {incident && detailQuery.isError && (
        <Group role="alert" justify="space-between">
          <Text size="sm">{getErrorMessage(detailQuery.error)}</Text>
          <Button
            variant="default"
            size="xs"
            onClick={() => detailQuery.refetch()}
          >
            Retry details
          </Button>
        </Group>
      )}
      {incident &&
        !detailQuery.isLoading &&
        !detailQuery.isError &&
        !detail && (
          <Text size="sm" role="status">No incident details are available.</Text>
        )}
      {detail && !detailQuery.isError && (
        <Stack gap="md">
          <Stack gap={6}>
            <Group gap="xs">
              <SeverityBadge severity={detail.severity} />
              <StatusPill status={detail.status} />
              {detail.code && <Text className="mono" size="xs" c="dimmed">{detail.code}</Text>}
            </Group>
            <Title order={2}>{detail.title}</Title>
            <Text c="dimmed" size="sm">{detail.summary}</Text>
          </Stack>

          <Group grow align="start">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Confidence</Text>
              <Text className="mono">{pct(detail.confidence)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Similarity</Text>
              <Text className="mono">{pct(detail.similarity)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Occurrences</Text>
              <Text className="mono">{detail.occurrences.toLocaleString()}</Text>
            </Stack>
          </Group>

          <Divider />
          <Stack gap={6}>
            <Text fw={650}>Explanation</Text>
            <Text size="sm">{detail.rootCause}</Text>
            <Text fw={650}>Remediation</Text>
            <Text size="sm">{detail.remediation}</Text>
          </Stack>

          <Group grow>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">First seen (UTC)</Text>
              <Text className="mono" size="sm">{formatUtcTimestamp(detail.firstSeen)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Last seen (UTC)</Text>
              <Text className="mono" size="sm">{formatUtcTimestamp(detail.lastSeen)}</Text>
            </Stack>
          </Group>

          <Stack gap={4}>
            <Text size="xs" c="dimmed">Affected modules</Text>
            {detail.modules.map((module) => (
              <Text key={module} className="mono" size="xs">{module}</Text>
            ))}
          </Stack>

          <Select
            label="Status"
            data={STATUSES}
            value={detail.status}
            onChange={(value) => value && statusMutation.mutate(value as Status)}
            disabled={statusMutation.isPending}
          />
          {statusMutation.isError && (
            <Text size="xs" role="alert">
              {getErrorMessage(statusMutation.error)}
            </Text>
          )}

          <Stack gap={6}>
            <Textarea
              label="Notes"
              placeholder="Add investigation note"
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              minRows={3}
            />
            <Button
              variant="default"
              size="xs"
              w={120}
              disabled={!note.trim()}
              loading={noteMutation.isPending}
              onClick={() => noteMutation.mutate(note.trim())}
            >
              Add note
            </Button>
            {detail.history.map((activity) => (
              <Text key={activity.id} size="xs" c="dimmed">
                <span className="mono">{formatUtcTimestamp(activity.at)}</span>{' '}
                {activity.actor}: {activity.body}
              </Text>
            ))}
            {detail.history.length === 0 && (
              <Text size="xs" c="dimmed">No activity has been recorded.</Text>
            )}
            {noteMutation.isError && (
              <Text size="xs" role="alert">
                {getErrorMessage(noteMutation.error)}
              </Text>
            )}
          </Stack>

          <Stack gap={6}>
            <Text fw={650}>Raw log entries</Text>
            {detail.entries.length > 0 ? (
              <ScrollArea h={280} className="surface" p="sm">
                <Stack gap="sm">
                  {detail.entries.map((entry) => (
                    <Text
                      key={entry.id}
                      size="xs"
                      className="log-entry"
                      style={{ fontFamily: FONT_MONO }}
                    >
                      [{formatUtcTimestamp(entry.timestamp)}] {entry.level.toUpperCase()} {entry.module}
                      {'\n'}
                      {entry.message}
                      {entry.stack ? `\n${entry.stack}` : ''}
                    </Text>
                  ))}
                </Stack>
              </ScrollArea>
            ) : (
              <Box className="surface" p="sm" role="status">
                <Text size="xs" c="dimmed">No raw log entries are available.</Text>
              </Box>
            )}
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}
