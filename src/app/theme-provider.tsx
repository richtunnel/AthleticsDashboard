"use client";

import { ReactNode } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

import lightTheme from "@/lib/theme/lightTheme";
import { createEmotionCache } from "@/lib/emotionCache";

const emotionCache = createEmotionCache();

export function MUIThemeProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      <ThemeProvider theme={lightTheme}>
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
            },
          })}
        />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
