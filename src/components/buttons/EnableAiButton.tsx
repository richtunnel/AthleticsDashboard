"use client";

import { Button } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

// 1. Component that defines the gradient and renders the MUI icon
export function GradientAI(props: { fontSize?: "small" | "medium" | "large" | string }) {
  // Define a unique ID for the gradient
  const gradientId = "aiGradient";

  return (
    <>
      {/* Hidden SVG to define the gradient for the entire page */}
      <svg width={0} height={0} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#70efafc8" />
            <stop offset="50%" stopColor="#8af4f6ff" />
            <stop offset="100%" stopColor="#00BCD4" />
          </linearGradient>
        </defs>
      </svg>

      {/* The actual Material-UI icon component */}
      <AutoAwesomeIcon
        // The fill property is key: it points the icon's path fill to the defined SVG gradient
        sx={{
          fill: `url(#${gradientId})`,
          // Inherit the size or set a default size
          fontSize: props.fontSize || "medium",
          // Use a negative margin to visually align the icon with the text in the button
          marginLeft: 1,
          marginRight: -0.5,
        }}
      />
    </>
  );
}

// 2. The final Button component using the custom icon
export default function AIButton() {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;

  const background = `linear-gradient(135deg, ${alpha(primary, 0.9)} 0%, ${alpha(secondary, 0.85)} 100%)`;
  const hoverBackground = `linear-gradient(135deg, ${alpha(primary, 1)} 0%, ${alpha(secondary, 0.95)} 100%)`;
  const boxShadow = "0 20px 45px rgba(65, 105, 225, 0.28)";
  const hoverBoxShadow = "0 24px 52px rgba(65, 105, 225, 0.35)";

  const buttonSx = {
    borderRadius: 16,
    mb: 3,
    px: 3,
    py: 1.5,
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    fontWeight: 600,
    textTransform: "none",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    background,
    color: "#FFFFFF",
    boxShadow,
    border: `1px solid ${alpha(primary, 0.3)}`,
    backdropFilter: "blur(6px)",
    "&:hover": {
      transform: "translateY(-2px)",
      background: hoverBackground,
      boxShadow: hoverBoxShadow,
    },
  } as const;

  return (
    <Button variant="contained" size="large" sx={buttonSx}>
      Enable AI <GradientAI fontSize="large" />
    </Button>
  );
}
