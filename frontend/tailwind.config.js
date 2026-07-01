/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4F46E5",
          600: "#4F46E5",
          700: "#4338CA",
          500: "#6366F1",
          100: "#E0E7FF",
          50: "#EEF2FF",
        },
        ink: "#1A1D23",
        muted: "#5B616E",
        faint: "#8A909C",
        surface: "#FFFFFF",
        canvas: "#F7F8FA",
        line: "#E7E9EE",
        hairline: "#EEF0F3",
        ok: { DEFAULT: "#059669", 600: "#047857", 50: "#ECFDF5" },
        warn: { DEFAULT: "#D97706", 600: "#B45309", 50: "#FFFBEB" },
        danger: { DEFAULT: "#DC2626", 600: "#B91C1C", 50: "#FEF2F2" },
        info: { DEFAULT: "#2563EB", 600: "#1D4ED8", 50: "#EFF6FF" },
      },
      fontFamily: {
        sans: [
          "InterVariable", "Inter", "ui-sans-serif", "system-ui", "-apple-system",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: [
          "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas",
          "Liberation Mono", "Courier New", "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        premium: "0 8px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
        pop: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 16px -6px rgba(0,0,0,0.05)",
        focus: "0 0 0 4px rgba(79,70,229,0.15)",
        glow: "0 0 20px rgba(79,70,229,0.08)",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "rail-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.9)" },
        },
      },
      animation: {
        "toast-in": "toast-in 240ms cubic-bezier(0.21, 1.02, 0.43, 1.01)",
        "fade-in": "fade-in 200ms ease-out",
        "pop-in": "pop-in 220ms cubic-bezier(0.21, 1.02, 0.43, 1.01)",
        "rail-pulse": "rail-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
