/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wellfit-blue': '#003865',   // restore hyphenated names
        'wellfit-green': '#8cc63f',
      },
    },
  },
  plugins: [],
};
