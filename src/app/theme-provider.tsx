"use client";

import { ReactNode } from "react";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";

import lightTheme from "@/lib/theme/lightTheme";

export function MUIThemeProvider({ children }: { children: ReactNode }) {
  return (
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
  );
}
