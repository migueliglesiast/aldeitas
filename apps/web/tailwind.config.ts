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
        ink: "#3D3B38",
        muted: "#78736B",
        line: "#E7E0D6",
        surface: "#F4EFE7",
        paper: "#FBF8F3",
        card: "#FFFDFA",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        poster: ["var(--font-poster)", "var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 18px rgba(61, 51, 38, 0.10)",
        pill: "0 3px 12px rgba(61, 51, 38, 0.08)",
        pop: "0 10px 30px rgba(61, 51, 38, 0.14)",
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
