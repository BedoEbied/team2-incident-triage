import { Badge, useMantineColorScheme } from '@mantine/core';
import type { Severity } from '../api/types';
import { SEVERITY_COLORS } from '../theme/tokens';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { colorScheme } = useMantineColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const color = SEVERITY_COLORS[severity][scheme];

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
      {severity}
    </Badge>
  );
}
