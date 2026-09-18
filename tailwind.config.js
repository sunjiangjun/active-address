/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          950: "#05080f",
          900: "#0a101c",
          800: "#111a2c",
          700: "#1a2740",
          600: "#243354",
        },
        accent: {
          DEFAULT: "#7b93ff",
          dim: "#4c64d4",
        },
      },
    },
  },
  plugins: [],
};
