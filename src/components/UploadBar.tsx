import { Box, Button, FileButton, Group, Progress, Text } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { getUploadJob, uploadFiles } from '../api/client';
import { getErrorMessage } from '../api/errors';

export function UploadBar() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFiles,
    onMutate: () => {
      setError(null);
      setJobId(null);
    },
    onSuccess: ({ jobId }) => {
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
  const jobError = jobQuery.isError
    ? getErrorMessage(jobQuery.error)
    : jobQuery.data?.status === 'failed'
      ? jobQuery.data.error ?? 'Log processing failed. Try uploading the files again.'
      : null;

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
      className="surface upload-bar"
      px="xs"
      py={6}
    >
      <Group gap="xs" align="center">
        <FileButton onChange={handleFiles} multiple>
          {(props) => (
            <Button {...props} variant="filled" size="xs" loading={mutation.isPending}>
              Upload logs
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed">Drop or select .log, .txt, or .json files</Text>
      </Group>
      {jobQuery.data && (
        <Group gap="xs" mt={6} align="center">
          <Progress
            aria-label="Upload progress"
            value={jobQuery.data.progress}
            color="brand"
            size="sm"
            w={180}
          />
          <Text size="xs" c="dimmed" className="mono">
            {jobQuery.data.status} {jobQuery.data.progress}%
          </Text>
        </Group>
      )}
      {(error || jobError) && (
        <Box mt={6} px="xs" py={6} role="alert">
          <Text size="xs">{error ?? jobError}</Text>
        </Box>
      )}
    </Box>
  );
}
