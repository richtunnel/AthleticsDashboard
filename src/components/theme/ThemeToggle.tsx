"use client";

import { IconButton, Tooltip, type SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { Brightness4Rounded, Brightness7Rounded } from "@mui/icons-material";
import { useThemeMode } from "@/lib/hooks/useTheme";

interface ThemeToggleProps {
  size?: "small" | "medium" | "large";
  edge?: false | "start" | "end";
  sx?: SxProps<Theme>;
}

export function ThemeToggle({ size = "medium", edge = false, sx }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useThemeMode();
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  const baseStyles: SxProps<Theme> = (theme) => ({
    borderRadius: 10,
    transition: "all 0.2s ease",
    backgroundColor: "transparent",
    color: theme.palette.text.secondary,
    boxShadow: "none",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    },
    "&:focus-visible": {
      outline: `3px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  });

  const combinedSx: SxProps<Theme> = Array.isArray(sx) ? [baseStyles, ...sx] : sx ? [baseStyles, sx] : [baseStyles];

  return (
    <Tooltip title={label} enterDelay={250} arrow>
      <IconButton
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={isDark}
        color="default"
        edge={edge}
        size={size}
        sx={combinedSx}
      >
        {isDark ? <Brightness7Rounded /> : <Brightness4Rounded />}
      </IconButton>
    </Tooltip>
  );
}

export default ThemeToggle;
