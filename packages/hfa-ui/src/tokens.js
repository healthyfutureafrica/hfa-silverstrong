/**
 * HFA design tokens: the single source of truth for colours, spacing, radii, shadows, fonts and
 * breakpoints. tailwind.config.js reads these values, and components import them when they need
 * a value in JavaScript (for example SVG strokes or canvas drawing).
 *
 * Brand colours come from the Cameroon flag: green, red and yellow.
 */

/** Brand and neutral colours. Shade 600 of green/red is the exact brand value. */
export const colors = {
  green: {
    50: '#E6F2EC',
    100: '#C2E0D0',
    200: '#8FC7A9',
    300: '#57AA7E',
    400: '#2A8F5C',
    500: '#007A48',
    600: '#006B3F', // HFA Green (primary)
    700: '#005833',
    800: '#004427',
    900: '#00301B',
    DEFAULT: '#006B3F'
  },
  red: {
    50: '#FDE8EA',
    100: '#F9C5CA',
    200: '#F2929C',
    300: '#E85E6D',
    400: '#DC3446',
    500: '#D41B30',
    600: '#CE1126', // HFA Red (accent, danger)
    700: '#A80E1F',
    800: '#820B18',
    900: '#5C0811',
    DEFAULT: '#CE1126'
  },
  yellow: {
    50: '#FFFBE6',
    100: '#FEF3B3',
    200: '#FDE980',
    300: '#FDDD4D',
    400: '#FCD116', // HFA Yellow (highlight) — always pair with dark text for contrast
    500: '#E3B800',
    600: '#B08F00',
    700: '#7D6600',
    800: '#4A3C00',
    900: '#2B2300',
    DEFAULT: '#FCD116'
  },
  amber: {
    500: '#F59E0B',
    600: '#D97706',
    DEFAULT: '#D97706'
  },
  dark: '#111827',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280', // mid-gray
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  },
  lightBg: '#F9FAFB',
  white: '#FFFFFF'
};

/** Semantic colours used by components, so meaning stays consistent across portals. */
export const semantic = {
  primary: colors.green[600],
  primaryHover: colors.green[700],
  accent: colors.red[600],
  danger: colors.red[600],
  highlight: colors.yellow[400],
  success: colors.green[600],
  warning: colors.amber[600],
  text: colors.dark,
  textMuted: colors.gray[500],
  background: colors.lightBg,
  surface: colors.white
};

/** 4px base spacing scale (values in pixels). */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64
};

/** Corner radii (pixels). */
export const radii = {
  card: 12,
  input: 8,
  button: 24,
  full: 9999
};

/** Elevation. */
export const shadows = {
  card: '0 2px 12px rgba(0,107,63,0.08)',
  raised: '0 8px 24px rgba(0,107,63,0.14)',
  focus: '0 0 0 3px rgba(0,107,63,0.35)'
};

/** Font stacks. Merriweather is for long-form clinical text (notes, articles, reports). */
export const fonts = {
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
  serif: ['Merriweather', 'Georgia', 'Cambria', 'Times New Roman', 'serif']
};

/** Mobile-first breakpoints (min-width, pixels). xs is an entry-level Android phone. */
export const breakpoints = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024
};

/** Profile picture rules shared by every portal (the server re-validates everything). */
export const AVATAR = {
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 5 * 1024 * 1024, // 5 MB (CHW portal passes 2 MB)
  chwMaxBytes: 2 * 1024 * 1024,
  minDimension: 200, // pixels, both width and height
  outputDimension: 800, // compressed to at most 800×800 before upload
  outputQuality: 0.85
};

/** Profile completion thresholds (percent). */
export const COMPLETION = {
  good: 80, // green ring at 80–100
  fair: 50, // amber ring at 50–79, red below 50
  minimumToAct: 60 // below this a user cannot book, prescribe or dispense
};

/** Returns the ring colour for a completion percentage. */
export function completionColor(percent) {
  if (percent >= COMPLETION.good) return colors.green[600];
  if (percent >= COMPLETION.fair) return colors.amber[600];
  return colors.red[600];
}

export default { colors, semantic, spacing, radii, shadows, fonts, breakpoints, AVATAR, COMPLETION, completionColor };
