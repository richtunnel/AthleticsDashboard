import { createTheme } from "@mui/material/styles";
import { buildThemeComponents } from "./components";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#93C5FD",
      light: "#BFDBFE",
      dark: "#60A5FA",
      contrastText: "#0B1120",
    },
    secondary: {
      main: "#C4B5FD",
      light: "#DDD6FE",
      dark: "#A78BFA",
      contrastText: "#0B1120",
    },
    background: {
      default: "#0B1120",
      paper: "#111827",
    },
    text: {
      primary: "#F8FAFC",
      secondary: "#CBD5F5",
    },
    divider: "rgba(148, 163, 184, 0.24)",
    success: {
      main: "#4ADE80",
    },
    warning: {
      main: "#FACC15",
    },
    error: {
      main: "#F87171",
    },
    info: {
      main: "#38BDF8",
    },
    grey: {
      50: "#0F172A",
      100: "#111C2E",
      200: "#17233A",
      300: "#1E2C48",
      400: "#253555",
      500: "#2F4266",
      600: "#3A4F78",
      700: "#4A5F8D",
      800: "#6477A3",
      900: "#93A9C7",
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

darkTheme.components = buildThemeComponents(darkTheme);

export default darkTheme;
