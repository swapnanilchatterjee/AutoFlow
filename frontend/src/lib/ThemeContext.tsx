import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  serverPreference: string;
  setServerPreference: (pref: string) => void;
}

const ThemeCtx = createContext<ThemeState | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("af_theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [serverPreference, setServerPreference] = useState<string>(() => {
    return localStorage.getItem("af_theme_preference") || "system";
  });

  useEffect(() => {
    localStorage.setItem("af_theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  function setThemeWithSync(t: Theme) {
    setTheme(t);
  }

  function setServerPreferenceWithSync(pref: string) {
    setServerPreference(pref);
    localStorage.setItem("af_theme_preference", pref);

    if (pref === "system") {
      localStorage.removeItem("af_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    } else if (pref === "light") {
      setTheme("light");
    } else if (pref === "dark") {
      setTheme("dark");
    }

    api.users.updateTheme(pref).catch(() => {});
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("af_theme_preference");
      if (!stored || stored === "system") {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    api.users.getTheme()
      .then((res) => {
        const pref = res.theme_preference || "system";
        setServerPreference(pref);
        localStorage.setItem("af_theme_preference", pref);
        if (pref === "system") {
          localStorage.removeItem("af_theme");
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setTheme(prefersDark ? "dark" : "light");
        } else if (pref === "light") {
          setTheme("light");
        } else if (pref === "dark") {
          setTheme("dark");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme: setThemeWithSync, serverPreference, setServerPreference: setServerPreferenceWithSync }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
