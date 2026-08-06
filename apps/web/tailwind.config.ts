import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF385C",
          dark: "#E31C5F",
          light: "#FF5A75",
        },
        ink: "#222222",
        muted: "#717171",
        line: "#DDDDDD",
        surface: "#F7F7F7",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 16px rgba(0, 0, 0, 0.12)",
        pill: "0 3px 12px rgba(0, 0, 0, 0.10)",
        pop: "0 8px 28px rgba(0, 0, 0, 0.18)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
