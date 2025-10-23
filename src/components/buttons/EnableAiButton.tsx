import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Button, Box } from "@mui/material";

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
  return (
    <Button
      variant="contained"
      size="large"
      sx={{
        borderRadius: 2,
        mb: 3,
        // Using a dark background to match your screenshot
        backgroundColor: "#1C1C1C",
        color: "#FFFFFF",
        "&:hover": {
          backgroundColor: "#333333",
        },
      }}
    >
      Enable AI <GradientAI fontSize="large" />
    </Button>
  );
}
