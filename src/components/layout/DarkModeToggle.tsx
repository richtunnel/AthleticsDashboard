"use client";

import { IconButton, Tooltip } from "@mui/material";
import { Brightness7, Brightness4 } from "@mui/icons-material";
import { useTheme } from "@/contexts/ThemeContext";

export default function DarkModeToggle() {
  const { mode, toggleTheme } = useTheme();

  return (
    <Tooltip title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
      <IconButton
        onClick={toggleTheme}
        sx={{
          mr: { xs: 0.5, sm: 1 },
          transition: "transform 0.3s ease, color 0.3s ease",
          "&:hover": {
            transform: "rotate(15deg)",
          },
        }}
        color="default"
        aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        {mode === "light" ? <Brightness4 /> : <Brightness7 />}
      </IconButton>
    </Tooltip>
  );
}
