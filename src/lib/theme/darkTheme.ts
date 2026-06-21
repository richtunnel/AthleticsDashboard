import { createTheme } from "@mui/material/styles";
import { buildThemeComponents } from "./components";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#c3f98fff", // Blue accent
      light: "#fafafaff",
      dark: "#90a7ddff",
      contrastText: "#000000", // Dark text for light cyan background
    },
    secondary: {
      main: "#10A37F", // Green accent
      light: "#1AB88C",
      dark: "#0E8C6C",
      contrastText: "#FFFFFF",
    },
    themeButtonText: {
      main: "#000",
      contrast: "#fff",
      subtle: "rgba(226, 226, 226, 0.94)",
    },

    themeText: {
      text: "#C5C5D2",
      contrastText: "#212121",
    },
    background: {
      default: "#212121", // Main dark background
      paper: "#2f2f2f", // Card/Paper background
    },
    text: {
      primary: "#ECECF1", // Light text
      secondary: "#C5C5D2", // Muted text
    },
    divider: "rgba(255, 255, 255, 0.12)",
    success: {
      main: "#10A37F",
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
      50: "#3A3A3A",
      100: "#424242",
      200: "#565869",
      300: "#6B6B7B",
      400: "#8E8EA0",
      500: "#ACACBE",
      600: "#C5C5D2",
      700: "#D1D5DB",
      800: "#E5E7EB",
      900: "#F3F4F6",
    },
    action: {
      hover: "rgba(255, 255, 255, 0.08)",
      selected: "rgba(109, 146, 226, 0.16)",
      disabled: "rgba(255, 255, 255, 0.3)",
      disabledBackground: "rgba(255, 255, 255, 0.12)",
    },
  },
  typography: {
    fontFamily: "var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

darkTheme.components = buildThemeComponents(darkTheme) as typeof darkTheme.components;

export default darkTheme;
