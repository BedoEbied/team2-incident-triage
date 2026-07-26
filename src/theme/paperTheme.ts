import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { CANVAS, RADIUS } from './tokens';

export function paperTheme(scheme: 'light' | 'dark'): MD3Theme {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const canvas = CANVAS[scheme];

  return {
    ...base,
    roundness: RADIUS,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: canvas.text,
      onPrimary: canvas.surface,
      primaryContainer: canvas.border,
      onPrimaryContainer: canvas.text,
      secondary: canvas.textDim,
      onSecondary: canvas.surface,
      secondaryContainer: canvas.border,
      onSecondaryContainer: canvas.text,
      tertiary: canvas.textDim,
      onTertiary: canvas.surface,
      tertiaryContainer: canvas.border,
      onTertiaryContainer: canvas.text,
      background: canvas.page,
      onBackground: canvas.text,
      surface: canvas.surface,
      onSurface: canvas.text,
      surfaceVariant: canvas.surface,
      onSurfaceVariant: canvas.textDim,
      outline: canvas.border,
      outlineVariant: canvas.border,
      elevation: {
        level0: 'transparent',
        level1: canvas.surface,
        level2: canvas.surface,
        level3: canvas.surface,
        level4: canvas.surface,
        level5: canvas.surface
      }
    }
  };
}
