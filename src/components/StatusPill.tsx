import { Badge, useMantineColorScheme } from '@mantine/core';
import type { Status } from '../api/types';
import { STATUS_COLORS } from '../theme/tokens';

export function StatusPill({ status }: { status: Status }) {
  const { colorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const color = STATUS_COLORS[status][scheme];

  return (
    <Badge
      variant="outline"
      radius={4}
      size="sm"
      styles={{
        root: {
          color,
          borderColor: color,
          background: 'transparent',
          fontSize: 11,
          height: 22,
          textTransform: 'none',
        },
      }}
    >
      {status}
    </Badge>
  );
}
