import { ScrollView, StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import { BRAND, CANVAS, RADIUS } from '@/theme/tokens';

/**
 * A row of filter/action chips that scrolls horizontally instead of dividing
 * a fixed width evenly. `SegmentedButtons` clips its last option once the
 * label count or length exceeds what fits on a phone-width screen (five
 * severities, or a single "Investigating" label, do not fit at 375px); chips
 * self-size to their label and simply scroll instead of truncating.
 */
export function FilterChipRow<T extends string>({
  value,
  onChange,
  options,
  disabled = false
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  const theme = useTheme();
  const scheme = theme.dark ? 'dark' : 'light';
  const canvas = CANVAS[scheme];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Chip
            key={option.value}
            selected={selected}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            mode={selected ? 'flat' : 'outlined'}
            compact
            style={[
              styles.chip,
              {
                backgroundColor: selected ? canvas.focus : canvas.surface,
                borderColor: selected ? canvas.focus : canvas.border
              }
            ]}
            textStyle={[styles.chipText, { color: selected ? BRAND.white : canvas.text }]}
          >
            {option.label}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -12 },
  rowContent: { gap: 6, paddingHorizontal: 12 },
  chip: { borderRadius: RADIUS.control },
  chipText: { fontSize: 12, fontWeight: '600', marginVertical: 4 }
});
