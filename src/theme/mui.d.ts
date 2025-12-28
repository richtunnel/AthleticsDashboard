import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    themeButtonText: {
      main: string;
      subtle?: string;
      contrast: string;
    };
    themeText: {
      text?: string;
      contrastText?: string;
    };
  }

  interface PaletteOptions {
    themeButtonText?: {
      main: string;
      subtle?: string;
      contrast: string;
    };
    themeText?: {
      text?: string;
      contrastText?: string;
    };
  }
}
