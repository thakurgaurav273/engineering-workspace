import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

export type Theme = "system" | "light" | "dark";

const EVENT = "grovyn-theme-change";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) || "system";
}

function computeIsDark(theme: Theme): boolean {
  if (typeof window === "undefined") return false;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", computeIsDark(theme));
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setIsDark(computeIsDark(stored));
    applyTheme(stored);

    const handler = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      setThemeState(t);
      setIsDark(computeIsDark(t));
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const set = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
    setIsDark(computeIsDark(t));
  };

  return { theme, isDark, setTheme: set };
}
