"use client";

import { ReactNode } from "react";
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
