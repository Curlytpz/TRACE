import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { accent: { 50: '#ecfdf5', 400: '#34d399', 500: '#10b981', 600: '#059669' } },
      boxShadow: { panel: '0 1px 2px rgb(15 23 42 / 0.06), 0 12px 30px rgb(15 23 42 / 0.05)' },
    },
  },
  plugins: [],
} satisfies Config;
