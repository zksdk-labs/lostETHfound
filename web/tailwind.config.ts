import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--ink)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)",
        muted: "var(--muted)",
        card: "var(--card)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        glow: "0 12px 40px rgba(255, 122, 26, 0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
