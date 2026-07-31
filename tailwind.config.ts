import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: "#0b6f4f",
        rail: "#32251d",
        brass: "#d6a84f",
        casinoRed: "#b92336",
      },
      boxShadow: {
        table: "0 24px 70px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
