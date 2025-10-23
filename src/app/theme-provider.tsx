"use client";

import { ReactNode, useMemo } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";

import lightTheme from "@/lib/theme/lightTheme";
import darkTheme from "@/lib/theme/darkTheme";
import { useThemeMode } from "@/lib/hooks/useTheme";

export function MUIThemeProvider({ children }: { children: ReactNode }) {
  const { mode } = useThemeMode();

  const theme = useMemo(() => (mode === "dark" ? darkTheme : lightTheme), [mode]);

  return (
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
          },
        })}
      />
      {children}
    </ThemeProvider>
  );
}
