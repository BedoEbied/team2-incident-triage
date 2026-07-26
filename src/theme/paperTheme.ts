import { configureFonts, type MD3Theme } from 'react-native-paper';
import { appFonts } from './fonts';
import { BRAND, CANVAS, RADIUS, SEVERITY_COLORS } from './tokens';

type ColorScheme = 'light' | 'dark';

function paperFonts(fontsLoaded: boolean): MD3Theme['fonts'] {
  const families = appFonts(fontsLoaded);
  const configured = configureFonts({
    config: {
      displayLarge: { fontFamily: families.display, fontWeight: '400' },
      displayMedium: { fontFamily: families.display, fontWeight: '400' },
      displaySmall: { fontFamily: families.display, fontWeight: '400' },
      headlineLarge: { fontFamily: families.display, fontWeight: '400' },
      headlineMedium: { fontFamily: families.display, fontWeight: '400' },
      headlineSmall: { fontFamily: families.display, fontWeight: '400' },
      titleLarge: { fontFamily: families.display, fontWeight: '400' },
      titleMedium: { fontFamily: families.uiSemibold, fontWeight: '600' },
      titleSmall: { fontFamily: families.uiSemibold, fontWeight: '600' },
      labelLarge: { fontFamily: families.uiSemibold, fontWeight: '600' },
      labelMedium: { fontFamily: families.uiMedium, fontWeight: '500' },
      labelSmall: { fontFamily: families.uiMedium, fontWeight: '500' },
      bodyLarge: { fontFamily: families.ui, fontWeight: '400' },
      bodyMedium: { fontFamily: families.ui, fontWeight: '400' },
      bodySmall: { fontFamily: families.ui, fontWeight: '400' }
    }
  });

  return {
    ...configured,
    default: {
      ...configured.default,
      fontFamily: families.ui,
      fontWeight: '400'
    }
  };
}

export function paperTheme(scheme: ColorScheme, fontsLoaded = false): MD3Theme {
  const canvas = CANVAS[scheme];
  const isDark = scheme === 'dark';
  const interactive = canvas.focus;
  const onInteractive = isDark ? BRAND.ink : BRAND.white;
  const critical = SEVERITY_COLORS.Critical[scheme];

  return {
    dark: isDark,
    mode: isDark ? 'exact' : undefined,
    roundness: RADIUS.control,
    version: 3,
    isV3: true,
    colors: {
      primary: interactive,
      primaryContainer: interactive,
      secondary: interactive,
      secondaryContainer: interactive,
      tertiary: interactive,
      tertiaryContainer: interactive,
      surface: canvas.surface,
      surfaceVariant: canvas.surfaceAlt,
      surfaceDisabled: isDark ? 'rgba(242, 237, 233, 0.12)' : 'rgba(7, 7, 7, 0.12)',
      background: canvas.page,
      error: critical,
      errorContainer: canvas.surfaceAlt,
      onPrimary: onInteractive,
      onPrimaryContainer: onInteractive,
      onSecondary: onInteractive,
      onSecondaryContainer: onInteractive,
      onTertiary: onInteractive,
      onTertiaryContainer: onInteractive,
      onSurface: canvas.text,
      onSurfaceVariant: canvas.textDim,
      onSurfaceDisabled: isDark ? 'rgba(242, 237, 233, 0.38)' : 'rgba(7, 7, 7, 0.38)',
      onError: isDark ? BRAND.ink : BRAND.white,
      onErrorContainer: critical,
      onBackground: canvas.text,
      outline: canvas.border,
      outlineVariant: canvas.border,
      inverseSurface: canvas.text,
      inverseOnSurface: canvas.page,
      inversePrimary: interactive,
      shadow: BRAND.ink,
      scrim: BRAND.ink,
      backdrop: isDark ? 'rgba(7, 7, 7, 0.72)' : 'rgba(7, 7, 7, 0.42)',
      elevation: {
        level0: 'transparent',
        level1: canvas.surface,
        level2: canvas.surface,
        level3: canvas.surface,
        level4: canvas.surface,
        level5: canvas.surface
      }
    },
    fonts: paperFonts(fontsLoaded),
    animation: {
      scale: 1
    }
  };
}
