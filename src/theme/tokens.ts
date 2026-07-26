/**
 * BRAND + DESIGN TOKENS — Team 2, AI Incident & Log Triage.
 *
 * Copy verbatim into web and mobile. One palette across both clients so the
 * submission reads as one product.
 *
 * ---------------------------------------------------------------------------
 * BRAND DIRECTION
 * ---------------------------------------------------------------------------
 * Derived from the Luciq design language (luciq.ai), adapted for a dense
 * operational tool. The character is:
 *
 *   - A WARM BONE canvas (#FBF8F6), never cold grey and never pure white.
 *     This is the single most recognisable thing about the brand — get it right
 *     and everything else follows.
 *   - Near-black INK (#070707) for text, with a warm grey (#6D6864) for support.
 *   - A SERIF DISPLAY face at REGULAR weight (400) for headings and big numbers.
 *     Not bold. The elegance comes from the letterforms, not the weight.
 *   - A neutral grotesque for UI text and a monospace for machine output.
 *   - ELECTRIC BLUE (#0A89FC) as the interactive accent: links, focus, primary
 *     buttons, active filter state.
 *   - ACID LIME (#B6FA05) as the signature brand mark, used sparingly — the
 *     logo mark, a focus ring, a live indicator. NEVER for severity or status;
 *     it must never read as a semantic state.
 *   - Radius 8px for cards and inputs, 16px for large panels. Not pills.
 *
 * ---------------------------------------------------------------------------
 * BANNED (both clients, non-negotiable)
 * ---------------------------------------------------------------------------
 *   - Gradients of any kind, especially purple->pink or blue->violet.
 *   - Purple/violet anywhere. React Native Paper's default MD3 purple theme
 *     must be overridden.
 *   - Glassmorphism, blur panels, stacked drop shadows. Borders over shadows.
 *   - Neon or candy colours beyond the two brand accents defined here.
 *   - Emoji used as iconography. "AI sparkle" motifs.
 *   - Cold grey (#F8F9FA / #FFFFFF) page backgrounds — the canvas is warm.
 *   - Bold display headings. Display type is weight 400.
 *   - Airy marketing spacing. This is a triage tool: rows 38-40px, body 13-14px.
 */

import type { Severity, Status } from './types';

/** Core brand ramp. */
export const BRAND = {
  ink: '#070707',
  inkSoft: '#1A1917',
  warmGrey: '#6D6864',
  bone: '#FBF8F6',
  boneDeep: '#F2EDE9',
  border: '#ECE7E3',
  white: '#FFFFFF',
  /** Interactive accent: links, focus, primary action, active filter. */
  blue: '#0A89FC',
  blueSoft: '#9DD0FE',
  /** Signature mark only — logo, live dot, focus ring. Never semantic. */
  lime: '#B6FA05',
  limeDeep: '#1D6100',
} as const;

/**
 * Severity. Tuned to sit on the warm bone canvas rather than cold grey.
 * Low is deliberately warm grey: a triage list should not shout about noise.
 */
export const SEVERITY_COLORS: Record<Severity, { light: string; dark: string }> = {
  Critical: { light: '#C2320F', dark: '#FF7A5C' },
  High: { light: '#D9660A', dark: '#FF9F45' },
  Medium: { light: '#B07800', dark: '#E8B33C' },
  Low: { light: '#6D6864', dark: '#8F8983' },
};

/** Separate family from severity so status is never misread as severity. Outline style. */
export const STATUS_COLORS: Record<Status, { light: string; dark: string }> = {
  New: { light: '#6D6864', dark: '#8F8983' },
  Investigating: { light: '#0A89FC', dark: '#5CB4FF' },
  Resolved: { light: '#1D6100', dark: '#8FD14F' },
};

/** Warm-tinted dark mode — a warm brand does not flip to neutral charcoal. */
export const CANVAS = {
  light: {
    page: BRAND.bone,
    surface: BRAND.white,
    surfaceAlt: BRAND.boneDeep,
    border: BRAND.border,
    text: BRAND.ink,
    textDim: BRAND.warmGrey,
    accentRow: 'rgba(194, 50, 15, 0.045)',
    focus: BRAND.blue,
  },
  dark: {
    page: '#0B0B0A',
    surface: '#141412',
    surfaceAlt: '#1C1B18',
    border: '#2A2724',
    text: '#F2EDE9',
    textDim: '#8F8983',
    accentRow: 'rgba(255, 122, 92, 0.07)',
    focus: '#5CB4FF',
  },
};

/**
 * Type. Luciq uses Arizona Flare (display serif) and Oracle (grotesque), both
 * commercial. These are the closest free stand-ins; the system fallbacks mean
 * the UI degrades gracefully with no network at demo time.
 */
export const FONT_DISPLAY =
  "'Instrument Serif', 'Arizona Flare', 'Times New Roman', Georgia, serif";

export const FONT_UI =
  "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Machine output: log lines, stack traces, error codes, timestamps, counts. */
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export const RADIUS = { control: 8, panel: 16 };

export const DENSITY = {
  rowHeight: 40,
  fontSize: 13,
  headerFontSize: 11,
  sectionGap: 16,
  /** Display numbers (incident counts, severity tallies) use the serif at 400. */
  statSize: 40,
};

/** Chart series — severity-ordered brand palette, never a library default rainbow. */
export const CHART_SERIES = (scheme: 'light' | 'dark') => [
  SEVERITY_COLORS.Critical[scheme],
  SEVERITY_COLORS.High[scheme],
  SEVERITY_COLORS.Medium[scheme],
  SEVERITY_COLORS.Low[scheme],
];
