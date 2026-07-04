import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#F8FAFC",
        surface: "#0B0F17",
        night: "#05070D",
        panel: "#0D121C",
        violet: {
          brand: "#6D28D9",
        },
        blue: {
          action: "#2563EB",
        },
        green: {
          success: "#10B981",
        },
        amber: {
          warn: "#F59E0B",
        },
        red: {
          danger: "#EF4444",
        },
      },
      boxShadow: {
        soft: "0 20px 70px rgba(15, 23, 42, 0.12)",
        panel: "0 18px 45px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
