import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wellfit-blue: '#003865',
        wellfit-green: '#8cc63f'
      }
    }
  },
  plugins: []
};

export default config;
