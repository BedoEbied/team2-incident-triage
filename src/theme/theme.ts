import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';
import {
  BRAND,
  CANVAS,
  DENSITY,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_UI,
  RADIUS,
} from './tokens';

const brand = [
  '#EAF5FF',
  '#D7ECFF',
  '#BEE0FE',
  BRAND.blueSoft,
  '#5CB4FF',
  '#32A0FD',
  BRAND.blue,
  '#0877DD',
  '#0566C1',
  '#034C92',
] as const satisfies MantineColorsTuple;

export const theme = createTheme({
  fontFamily: FONT_UI,
  fontFamilyMonospace: FONT_MONO,
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'sm',
  black: BRAND.ink,
  white: BRAND.white,
  radius: {
    xs: '4px',
    sm: `${RADIUS.control}px`,
    md: `${RADIUS.panel}px`,
    lg: `${RADIUS.panel}px`,
    xl: `${RADIUS.panel}px`,
  },
  fontSizes: {
    xs: `${DENSITY.headerFontSize}px`,
    sm: `${DENSITY.fontSize}px`,
    md: '14px',
  },
  headings: {
    fontFamily: FONT_DISPLAY,
    fontWeight: '400',
    sizes: {
      h1: { fontSize: '32px', lineHeight: '1.05', fontWeight: '400' },
      h2: { fontSize: '22px', lineHeight: '1.15', fontWeight: '400' },
      h3: { fontSize: '18px', lineHeight: '1.2', fontWeight: '400' },
    },
  },
  colors: {
    brand,
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--triage-display': FONT_DISPLAY,
    '--triage-ui': FONT_UI,
    '--triage-mono': FONT_MONO,
    '--triage-blue': BRAND.blue,
    '--triage-lime': BRAND.lime,
  },
  light: {
    '--mantine-color-body': CANVAS.light.page,
    '--mantine-color-text': CANVAS.light.text,
    '--mantine-color-dimmed': CANVAS.light.textDim,
    '--mantine-color-placeholder': CANVAS.light.textDim,
    '--mantine-color-anchor': BRAND.blue,
    '--mantine-color-default': CANVAS.light.surface,
    '--mantine-color-default-hover': CANVAS.light.surfaceAlt,
    '--mantine-color-default-color': CANVAS.light.text,
    '--mantine-color-default-border': CANVAS.light.border,
    '--triage-page': CANVAS.light.page,
    '--triage-surface': CANVAS.light.surface,
    '--triage-surface-alt': CANVAS.light.surfaceAlt,
    '--triage-border': CANVAS.light.border,
    '--triage-text': CANVAS.light.text,
    '--triage-dim': CANVAS.light.textDim,
    '--triage-accent-row': CANVAS.light.accentRow,
    '--triage-focus': CANVAS.light.focus,
  },
  dark: {
    '--mantine-color-body': CANVAS.dark.page,
    '--mantine-color-text': CANVAS.dark.text,
    '--mantine-color-dimmed': CANVAS.dark.textDim,
    '--mantine-color-placeholder': CANVAS.dark.textDim,
    '--mantine-color-anchor': CANVAS.dark.focus,
    '--mantine-color-default': CANVAS.dark.surface,
    '--mantine-color-default-hover': CANVAS.dark.surfaceAlt,
    '--mantine-color-default-color': CANVAS.dark.text,
    '--mantine-color-default-border': CANVAS.dark.border,
    '--triage-page': CANVAS.dark.page,
    '--triage-surface': CANVAS.dark.surface,
    '--triage-surface-alt': CANVAS.dark.surfaceAlt,
    '--triage-border': CANVAS.dark.border,
    '--triage-text': CANVAS.dark.text,
    '--triage-dim': CANVAS.dark.textDim,
    '--triage-accent-row': CANVAS.dark.accentRow,
    '--triage-focus': CANVAS.dark.focus,
  },
});
