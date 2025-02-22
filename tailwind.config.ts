import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // 🔹 Dark Mode Desteği Eklendi!
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};

// 🔥 Sadece BİR `export default` olmalı!
export default config;

