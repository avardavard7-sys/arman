import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0A1628',
        navy2: '#13233C',
        paper: '#F5F1E8',
        sand: '#EDE7D8',
        ink: '#1B2434',
        terra: '#C3552D',
        gold: '#DE9F3B',
      },
    },
  },
  plugins: [],
};
export default config;
