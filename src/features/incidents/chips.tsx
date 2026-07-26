import { StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import type { Severity, Status } from '@/api/types';
import { CANVAS, RADIUS, SEVERITY_COLORS, STATUS_COLORS } from '@/theme/tokens';

export function SeverityChip({ severity }: { severity: Severity }) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const color = SEVERITY_COLORS[severity][scheme];

  return (
    <Chip compact mode="outlined" textStyle={[styles.label, { color }]} style={[styles.chip, { borderColor: color }]}>
      {severity}
    </Chip>
  );
}

export function StatusChip({ status }: { status: Status }) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const color = STATUS_COLORS[status][scheme];
  const canvas = CANVAS[scheme];

  return (
    <Chip compact mode="outlined" textStyle={[styles.label, { color }]} style={[styles.chip, { borderColor: color, backgroundColor: canvas.surface }]}>
      {status}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: { height: 28, borderRadius: RADIUS.control },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' }
});
