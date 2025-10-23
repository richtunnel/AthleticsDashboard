import { createTheme } from "@mui/material/styles";
import { buildThemeComponents } from "./components";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#4169E1",
      light: "#6B8CFF",
      dark: "#2740B2",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#8B5CF6",
      light: "#A78BFA",
      dark: "#6C2BD9",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F6F8FB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F172A",
      secondary: "#475569",
    },
    divider: "rgba(15, 23, 42, 0.08)",
    success: {
      main: "#22C55E",
    },
    warning: {
      main: "#F59E0B",
    },
    error: {
      main: "#EF4444",
    },
    info: {
      main: "#38BDF8",
    },
    grey: {
      50: "#F8FAFC",
      100: "#F1F5F9",
      200: "#E2E8F0",
      300: "#CBD5E1",
      400: "#94A3B8",
      500: "#64748B",
      600: "#475569",
      700: "#334155",
      800: "#1E293B",
      900: "#0F172A",
    },
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
    subtitle1: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

lightTheme.components = buildThemeComponents(lightTheme);

export default lightTheme;
