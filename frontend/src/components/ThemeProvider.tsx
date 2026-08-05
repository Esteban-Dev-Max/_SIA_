"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ResolvedTheme, type Theme } from "@/lib/theme";

const STORAGE_KEY = "sia-theme";
const THEME_MEDIA = "(prefers-color-scheme: dark)";

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

function systemResolved(): ResolvedTheme {
  return window.matchMedia(THEME_MEDIA).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // El tema guardado se aplica tras el montaje para que el SSR y el primer render del
  // cliente coincidan (evita errores de hidratación). La clase ya la aplica el script
  // inline de __root, así que no hay parpadeo visual.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") setThemeState(saved);
  }, []);

  useEffect(() => {
    const next = theme === "system" ? systemResolved() : theme;
    applyTheme(next);
    setResolvedTheme(next);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia(THEME_MEDIA);
    const onChange = () => {
      const next = mql.matches ? "dark" : "light";
      applyTheme(next);
      setResolvedTheme(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
