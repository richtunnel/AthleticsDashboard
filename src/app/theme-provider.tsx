"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ReactNode } from "react";

const theme = createTheme({
  palette: {
    primary: {
      main: "#23252aff", // Blue
    },
    secondary: {
      main: "#64748b", // Slate
    },
    success: {
      main: "#22c55e", // Green
    },
    warning: {
      main: "#f59e0b", // Orange
    },
    error: {
      main: "#ef4444", // Red
    },
  },
  colorSchemes: {
    dark: false,
    light: true,
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 6,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});

export function MUIThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
