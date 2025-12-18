/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "wellfit-blue": "#003865",
        "wellfit-green": "#8CC63F",
      },
      keyframes: {
        "wf-slide-in": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "wf-fade-in": {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "wf-spin": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "wf-slide-in": "wf-slide-in 0.3s ease-out both",
        "wf-fade-in": "wf-fade-in 0.2s ease-out both",
        "wf-spin": "wf-spin 1s linear infinite",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true, // silences common hover/touch warning
  },
  plugins: [
    // require("@tailwindcss/forms"), // optional: nicer form controls
  ],
};
