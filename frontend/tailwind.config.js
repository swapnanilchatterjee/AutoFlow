/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6366F1",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          light: "#F8FAFC",
          dark: "#0F172A",
          "dark-card": "#1E293B",
          "dark-hover": "#334155",
        },
        ink: {
          DEFAULT: "#0F172A",
          light: "#334155",
          muted: "#64748B",
          faint: "#94A3B8",
          dark: "#F1F5F9",
          "dark-light": "#CBD5E1",
          "dark-muted": "#94A3B8",
          "dark-faint": "#64748B",
        },
        line: {
          DEFAULT: "#E2E8F0",
          light: "#F1F5F9",
          dark: "#334155",
          "dark-light": "#1E293B",
        },
        ok: { DEFAULT: "#10B981", 600: "#059669", 50: "#ECFDF5", dark: "#059669" },
        warn: { DEFAULT: "#F59E0B", 600: "#D97706", 50: "#FFFBEB" },
        danger: { DEFAULT: "#EF4444", 600: "#DC2626", 50: "#FEF2F2" },
        info: { DEFAULT: "#3B82F6", 600: "#2563EB", 50: "#EFF6FF" },
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
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
        premium: "0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.03)",
        "premium-hover": "0 12px 24px -8px rgba(0, 0, 0, 0.08), 0 4px 8px -4px rgba(0, 0, 0, 0.04)",
        pop: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
        "pop-lg": "0 20px 40px -12px rgba(0,0,0,0.12), 0 8px 16px -8px rgba(0,0,0,0.06)",
        focus: "0 0 0 3px rgba(99,102,241,0.2)",
        "inset-card": "inset 0 1px 0 0 rgba(255,255,255,0.6)",
        "dark-card": "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        "dark-premium": "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)",
        "dark-premium-hover": "0 12px 24px -8px rgba(0, 0, 0, 0.5), 0 4px 8px -4px rgba(0, 0, 0, 0.3)",
        "dark-pop": "0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.2)",
        glow: "0 0 24px rgba(99,102,241,0.15), 0 0 48px rgba(99,102,241,0.05)",
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
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "rail-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.9)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "toast-in": "toast-in 240ms cubic-bezier(0.21, 1.02, 0.43, 1.01)",
        "fade-in": "fade-in 200ms ease-out",
        "pop-in": "pop-in 220ms cubic-bezier(0.21, 1.02, 0.43, 1.01)",
        "slide-in-right": "slide-in-right 200ms ease-out",
        "rail-pulse": "rail-pulse 1.6s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
