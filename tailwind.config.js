/**
 * Theme colours live in CSS custom properties (see src/styles/global.css) so the
 * user can switch themes at runtime. Tailwind can't add an alpha channel to a bare
 * `var(--x)`, so opacity modifiers like `bg-primary-500/20` would silently generate
 * no CSS at all. Wrapping each variable in color-mix() with Tailwind's <alpha-value>
 * placeholder makes those modifiers work.
 */
const themeColor = (name) =>
  `color-mix(in srgb, var(--color-${name}) calc(<alpha-value> * 100%), transparent)`;

const scale = (prefix, steps) =>
  Object.fromEntries(steps.map((step) => [step, themeColor(`${prefix}-${step}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: scale('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        surface: scale('surface', [600, 700, 800, 900, 950]),
        accent: scale('accent', [400, 500, 600]),
        // Text hierarchy (text-content-primary / -secondary / -muted)
        content: {
          primary: themeColor('text-primary'),
          secondary: themeColor('text-secondary'),
          muted: themeColor('text-muted'),
        },
        border: themeColor('border'),
        'card-bg': themeColor('card-bg'),
        'input-bg': themeColor('input-bg'),
        'glass-bg': themeColor('glass-bg'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up-stagger': 'slideUpStagger 0.4s ease-out both',
        'pop-in': 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(45, 212, 191, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(45, 212, 191, 0.6)' },
        },
        slideUpStagger: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        popIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        zoneExpand: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

