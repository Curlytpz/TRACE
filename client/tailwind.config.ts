import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { accent: { 50: '#f5f3ff', 400: '#a78bfa', 500: '#8b5cf6', 600: '#6d28d9' } },
      boxShadow: { panel: '0 1px 2px rgb(15 23 42 / 0.06), 0 12px 30px rgb(15 23 42 / 0.05)' },
    },
  },
  plugins: [],
} satisfies Config;
