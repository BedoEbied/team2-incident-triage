/**
 * FROZEN DESIGN TOKENS — Team 2, AI Incident & Log Triage.
 *
 * Copy verbatim into web and mobile. One palette across both clients so the
 * submission reads as one product.
 *
 * Reference points: Sentry, Datadog, Linear. This is an on-call triage tool —
 * dense, neutral, and quiet, with colour carrying meaning and nothing else.
 *
 * BANNED (both clients, non-negotiable):
 *   - Gradients of any kind, especially purple->pink or blue->violet.
 *   - Glassmorphism, blur panels, stacked drop shadows. Borders over shadows.
 *   - Neon, pastel or candy colours. Colour-tinted page backgrounds.
 *   - Emoji used as iconography. "AI sparkle" motifs.
 *   - Pill radius on everything (radius is 4px, not 9999px).
 *   - More than one accent hue beyond the semantic severity/status colours.
 *   - Airy marketing spacing. Rows are 36-40px, body text 13-14px.
 *   - React Native Paper's default purple MD3 theme. Override it.
 *
 * WHERE COLOUR IS ALLOWED: severity badge, the 3px left accent border on
 * Critical/High rows, chart series, and the status pill. Nowhere else.
 * Buttons, headers, cards and nav are neutral.
 */

import type { Severity, Status } from './types';

/** Low is deliberately grey: a triage list should not shout about low-severity noise. */
export const SEVERITY_COLORS: Record<Severity, { light: string; dark: string }> = {
  Critical: { light: '#C92A2A', dark: '#FF6B6B' },
  High: { light: '#E8590C', dark: '#FF922B' },
  Medium: { light: '#F08C00', dark: '#FCC419' },
  Low: { light: '#868E96', dark: '#909296' },
};

/** Separate family from severity so status is never misread as severity. Outline style, not filled. */
export const STATUS_COLORS: Record<Status, { light: string; dark: string }> = {
  New: { light: '#868E96', dark: '#909296' },
  Investigating: { light: '#1971C2', dark: '#4DABF7' },
  Resolved: { light: '#2F9E44', dark: '#51CF66' },
};

export const CANVAS = {
  light: {
    page: '#F8F9FA',
    surface: '#FFFFFF',
    border: '#DEE2E6',
    text: '#212529',
    textDim: '#868E96',
    accentRow: 'rgba(201, 42, 42, 0.05)',
  },
  dark: {
    page: '#101113',
    surface: '#18191B',
    border: '#2C2E33',
    text: '#C1C2C5',
    textDim: '#909296',
    accentRow: 'rgba(255, 107, 107, 0.07)',
  },
};

export const RADIUS = 4;

export const DENSITY = {
  rowHeight: 38,
  fontSize: 13,
  headerFontSize: 12,
  sectionGap: 16,
};

/**
 * Monospace for log lines, stack traces, error codes and timestamps.
 * This single choice does most of the work in making the UI read as an
 * engineering tool rather than a template.
 */
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

/** Chart series order — severity-ordered, same palette, no rainbow defaults. */
export const CHART_SERIES = (scheme: 'light' | 'dark') => [
  SEVERITY_COLORS.Critical[scheme],
  SEVERITY_COLORS.High[scheme],
  SEVERITY_COLORS.Medium[scheme],
  SEVERITY_COLORS.Low[scheme],
];
