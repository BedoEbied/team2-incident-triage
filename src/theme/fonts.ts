import { Platform } from 'react-native';
import { FONT_DISPLAY, FONT_MONO, FONT_UI } from './tokens';

export const FONT_ASSETS = {
  InstrumentSerif_400Regular:
    require('@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf'),
  InstrumentSans_400Regular:
    require('@expo-google-fonts/instrument-sans/400Regular/InstrumentSans_400Regular.ttf'),
  InstrumentSans_500Medium:
    require('@expo-google-fonts/instrument-sans/500Medium/InstrumentSans_500Medium.ttf'),
  InstrumentSans_600SemiBold:
    require('@expo-google-fonts/instrument-sans/600SemiBold/InstrumentSans_600SemiBold.ttf')
} as const;

export type AppFonts = {
  display: string;
  ui: string;
  uiMedium: string;
  uiSemibold: string;
  mono: string;
};

const systemFonts: AppFonts = {
  display: Platform.select({
    android: 'serif',
    default: 'Times New Roman',
    web: FONT_DISPLAY
  }),
  ui: Platform.select({
    android: 'sans-serif',
    default: 'System',
    web: FONT_UI
  }),
  uiMedium: Platform.select({
    android: 'sans-serif-medium',
    default: 'System',
    web: FONT_UI
  }),
  uiSemibold: Platform.select({
    android: 'sans-serif-medium',
    default: 'System',
    web: FONT_UI
  }),
  mono: Platform.select({
    android: 'monospace',
    default: 'Menlo',
    web: FONT_MONO
  })
};

const instrumentFonts: AppFonts = {
  display: 'InstrumentSerif_400Regular',
  ui: 'InstrumentSans_400Regular',
  uiMedium: 'InstrumentSans_500Medium',
  uiSemibold: 'InstrumentSans_600SemiBold',
  mono: systemFonts.mono
};

export function appFonts(loaded: boolean): AppFonts {
  return loaded ? instrumentFonts : systemFonts;
}
