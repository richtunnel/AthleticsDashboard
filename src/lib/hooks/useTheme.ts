"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY, useThemeStore, type ThemeMode } from "../stores/themeStore";

export interface UseThemeModeResult {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useThemeMode = (): UseThemeModeResult => {
  const mode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const setTheme = useThemeStore((state) => state.setTheme);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.style.setProperty("color-scheme", mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored) {
          return;
        }
      } catch (error) {
        // ignore storage parsing errors
      }

      setTheme(event.matches ? "dark" : "light");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [setTheme]);

  return {
    mode,
    isDark: mode === "dark",
    toggleTheme,
    setTheme,
  };
};
