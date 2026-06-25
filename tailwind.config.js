/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f9fafb',
          card: '#ffffff',
          sidebar: '#f8fafc',
        },
        ink: {
          DEFAULT: '#111827',
          muted: '#374151',
          subtle: '#4b5563',
          light: '#6b7280',
        },
        state: {
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
          info: '#6366f1',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
    },
  },
  plugins: [],
};
