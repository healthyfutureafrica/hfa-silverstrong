/**
 * HFA Tailwind CSS preset (Tailwind 3.4).
 *
 * Every portal uses this file as a preset so all six apps share one design system:
 *
 *   // portals/patient/tailwind.config.js
 *   import hfa from '@hfa/ui/tailwind.config.js';
 *   export default {
 *     presets: [hfa],
 *     content: ['./index.html', './src/**\/*.{js,jsx}', './node_modules/@hfa/ui/src/**\/*.{js,jsx}']
 *   };
 *
 * Dark mode uses the `class` strategy: add `dark` to <html> to switch the whole app.
 */
import { colors, radii, shadows, fonts, breakpoints } from './src/tokens.js';

const px = value => `${value}px`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    // Mobile-first breakpoints; replacing (not extending) keeps class names predictable.
    screens: {
      xs: px(breakpoints.xs),
      sm: px(breakpoints.sm),
      md: px(breakpoints.md),
      lg: px(breakpoints.lg)
    },
    extend: {
      colors: {
        hfa: {
          green: colors.green,
          red: colors.red,
          yellow: colors.yellow,
          amber: colors.amber,
          dark: colors.dark,
          gray: colors.gray,
          'light-bg': colors.lightBg
        },
        primary: { ...colors.green, DEFAULT: colors.green[600] },
        accent: { ...colors.red, DEFAULT: colors.red[600] },
        highlight: { ...colors.yellow, DEFAULT: colors.yellow[400] },
        danger: { ...colors.red, DEFAULT: colors.red[600] },
        warning: colors.amber,
        surface: { DEFAULT: colors.white, muted: colors.lightBg, dark: '#0B1220', 'dark-raised': colors.gray[800] }
      },
      fontFamily: {
        sans: fonts.sans,
        serif: fonts.serif,
        clinical: fonts.serif
      },
      borderRadius: {
        card: px(radii.card),
        input: px(radii.input),
        button: px(radii.button)
      },
      boxShadow: {
        card: shadows.card,
        raised: shadows.raised,
        focus: shadows.focus
      },
      // Tailwind's default spacing already uses a 4px base (1 = 4px); these named steps mirror
      // the HFA scale for readability in components.
      spacing: {
        'hfa-1': '4px',
        'hfa-2': '8px',
        'hfa-3': '12px',
        'hfa-4': '16px',
        'hfa-6': '24px',
        'hfa-8': '32px',
        'hfa-12': '48px',
        'hfa-16': '64px'
      },
      minHeight: {
        touch: '44px' // minimum comfortable touch target on phones
      },
      minWidth: {
        touch: '44px'
      },
      keyframes: {
        'hfa-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'hfa-slide-up': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } }
      },
      animation: {
        'hfa-fade-in': 'hfa-fade-in 150ms ease-out',
        'hfa-slide-up': 'hfa-slide-up 200ms ease-out'
      }
    }
  },
  plugins: []
};
