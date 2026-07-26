import { createTheme } from '@mantine/core';
import { CANVAS, DENSITY, FONT_MONO, RADIUS } from './tokens';

export const theme = createTheme({
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: FONT_MONO,
  primaryColor: 'gray',
  defaultRadius: RADIUS,
  fontSizes: {
    xs: '11px',
    sm: `${DENSITY.headerFontSize}px`,
    md: `${DENSITY.fontSize}px`,
  },
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sizes: {
      h1: { fontSize: '18px', lineHeight: '1.25', fontWeight: '650' },
      h2: { fontSize: '14px', lineHeight: '1.3', fontWeight: '650' },
      h3: { fontSize: '13px', lineHeight: '1.3', fontWeight: '650' },
    },
  },
  colors: {
    neutral: [
      CANVAS.light.page,
      '#F1F3F5',
      CANVAS.light.border,
      '#CED4DA',
      '#ADB5BD',
      CANVAS.light.textDim,
      '#495057',
      '#343A40',
      CANVAS.light.text,
      CANVAS.dark.page,
    ],
  },
});
