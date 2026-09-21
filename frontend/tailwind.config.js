/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        emerald: {
          DEFAULT: "#1ec677",
          50: "#f0fdf6",
          100: "#ecf9ee",
          200: "#c7f2d5",
          300: "#8ee5b1",
          400: "#4fd38a",
          500: "#1ec677",
          600: "#13a25e",
          700: "#127f4c",
          800: "#13643e",
          900: "#0d4029",
          950: "#071910",
        },
        obsidian: {
          base: "#071910",
          card: "#0d281a",
          elevated: "#133825",
          border: "rgba(30, 198, 119, 0.18)",
        },
        whisper: {
          base: "#ecf9ee",
          card: "#ffffff",
          elevated: "#f4fcf5",
          border: "rgba(13, 64, 41, 0.12)",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
