"use client";

import { ReactNode, useEffect } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import lightTheme from "@/lib/theme/lightTheme";
import darkTheme from "@/lib/theme/darkTheme";
import { createEmotionCache } from "@/lib/emotionCache";

const emotionCache = createEmotionCache();

interface MUIThemeProviderProps {
  children: ReactNode;
  mode?: "light" | "dark";
}

export function MUIThemeProvider({ children, mode = "light" }: MUIThemeProviderProps) {
  const theme = mode === "dark" ? darkTheme : lightTheme;

  // Apply data-theme attribute to document element for CSS variables
  useEffect(() => {
    if (typeof document !== "undefined") {
      const previousMode = document.documentElement.getAttribute("data-theme");
      document.documentElement.setAttribute("data-theme", mode);

      return () => {
        if (previousMode) {
          document.documentElement.setAttribute("data-theme", previousMode);
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      };
    }
  }, [mode]);

  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles
          styles={(currentTheme) => ({
            "::selection": {
              backgroundColor: currentTheme.palette.primary.main,
              color: currentTheme.palette.primary.contrastText,
            },
            a: {
              color: currentTheme.palette.primary.main,
              textDecoration: "none",
            },
            "a:hover": {
              textDecoration: "underline",
            },
            "html, body": {
              backgroundColor: currentTheme.palette.background.default,
              color: currentTheme.palette.text.primary,
              transition: "background-color 0.3s ease, color 0.3s ease",
            },
            "*": {
              transition: "background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease",
            },
          })}
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
