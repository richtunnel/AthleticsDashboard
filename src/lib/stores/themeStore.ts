"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const THEME_STORAGE_KEY = "ad-hub-theme";

const getStoredMode = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const persisted = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!persisted) {
      return null;
    }

    const parsed = JSON.parse(persisted) as { state?: { mode?: ThemeMode } };
    const mode = parsed?.state?.mode;
    if (mode === "light" || mode === "dark") {
      return mode;
    }
    return null;
  } catch (error) {
    return null;
  }
};

const getPreferredMode = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = getStoredMode();
  if (stored) {
    return stored;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

const applyTheme = (mode: ThemeMode) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.style.setProperty("color-scheme", mode);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: getPreferredMode(),
      toggleTheme: () => {
        const nextMode: ThemeMode = get().mode === "light" ? "dark" : "light";
        applyTheme(nextMode);
        set({ mode: nextMode });
      },
      setTheme: (mode) => {
        if (mode !== "light" && mode !== "dark") {
          return;
        }
        applyTheme(mode);
        set({ mode });
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.mode);
        }
      },
    }
  )
);

if (typeof window !== "undefined") {
  applyTheme(useThemeStore.getState().mode);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = (event: MediaQueryListEvent) => {
    if (getStoredMode()) {
      return;
    }
    useThemeStore.getState().setTheme(event.matches ? "dark" : "light");
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleSystemChange);
  } else {
    mediaQuery.addListener(handleSystemChange);
  }
}
