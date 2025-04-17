import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wellfitBlue: '#003865',
        wellfitGreen: '#8cc63f'
      }
    }
  },
  plugins: []
};

export default config;