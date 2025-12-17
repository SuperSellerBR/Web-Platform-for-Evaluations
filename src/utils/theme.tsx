import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = "app:theme";

function getStoredTheme(): ThemeMode {
  const stored = typeof window !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null;
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function prefersDark(): boolean {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    theme === "system" ? (prefersDark() ? "dark" : "light") : theme
  );

  const applyTheme = (mode: ThemeMode) => {
    const isDark = mode === "dark" || (mode === "system" && prefersDark());
    const resolved = isDark ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    setResolvedTheme(resolved);
    window.dispatchEvent(
      new CustomEvent("themechange", {
        detail: { theme: mode, resolved },
      })
    );
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (mode: ThemeMode) => setThemeState(mode),
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
