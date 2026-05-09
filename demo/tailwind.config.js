/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
          muted: "#93c5fd",
        },
        surface: {
          DEFAULT: "#f8fafc",
          elevated: "#ffffff",
          border: "#e2e8f0",
        },
        danger: {
          DEFAULT: "#dc2626",
          foreground: "#fef2f2",
        },
      },
      spacing: {
        "layout-xs": "0.5rem",
        "layout-sm": "1rem",
        "layout-md": "1.5rem",
        "layout-lg": "2rem",
      },
      borderRadius: {
        ds: "0.5rem",
        "ds-lg": "0.75rem",
      },
    },
  },
  plugins: [],
};
