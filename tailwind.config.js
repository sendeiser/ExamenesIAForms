/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F5F0',
        paper: '#FFFFFF',
        sand: {
          50: '#FAF9F6',
          100: '#F2EFE9',
          200: '#EBE7DC',
          300: '#E4E0D8',
          400: '#D6D1C5',
        },
        brand: {
          50: '#EEF3FA',
          100: '#DCE5F2',
          200: '#B8CBE5',
          300: '#8FAED6',
          400: '#5D87BF',
          500: '#2E5899',
          600: '#1B3B6F',
          700: '#152E58',
          800: '#0E2447',
          900: '#091830',
        },
        terracotta: {
          50: '#FDF3F1',
          100: '#F9E2DC',
          200: '#F2C0B4',
          500: '#C84B31',
          600: '#A93C25',
          700: '#852D1B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7F5F0',
          card: '#FFFFFF',
          sidebar: '#F2EFE9',
        },
        ink: {
          DEFAULT: '#1C1917',
          muted: '#44403C',
          subtle: '#57534E',
          light: '#78716C',
        },
        state: {
          success: '#15803D',
          warning: '#B45309',
          error: '#B91C1C',
          info: '#1B3B6F',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        paper: '0 1px 2px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.03)',
        'paper-hover': '0 6px 20px rgba(27, 59, 111, 0.08), 0 2px 6px rgba(28, 25, 23, 0.04)',
      },
    },
  },
  plugins: [],
};
