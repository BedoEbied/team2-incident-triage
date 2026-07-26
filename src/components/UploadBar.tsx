import { Box, Button, FileButton, Group, Progress, Text } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { getErrorMessage, getUploadJob, uploadFiles } from '../api/client';

export function UploadBar() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFiles,
    onSuccess: ({ jobId }) => {
      setError(null);
      setJobId(jobId);
    },
    onError: (error) => setError(getErrorMessage(error)),
  });

  const jobQuery = useQuery({
    queryKey: ['upload', jobId],
    queryFn: () => getUploadJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : 900;
    },
  });

  const handleFiles = (files: File[] | null) => {
    if (!files?.length) return;
    mutation.mutate(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Box
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="surface"
      px="xs"
      py={6}
    >
      <Group gap="xs" align="center">
        <FileButton onChange={handleFiles} multiple>
          {(props) => (
            <Button {...props} variant="default" size="xs" loading={mutation.isPending}>
              Upload logs
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed">multi-file, repeatable `files` field</Text>
      </Group>
      {jobQuery.data && (
        <Group gap="xs" mt={6} align="center">
          <Progress value={jobQuery.data.progress} size="sm" w={180} />
          <Text size="xs" c="dimmed" className="mono">
            {jobQuery.data.status} {jobQuery.data.progress}%
          </Text>
        </Group>
      )}
      {error && (
        <Box className="surface" mt={6} px="xs" py={6}>
          <Text size="xs">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
