import { Box, useTheme } from "@mui/material";

export const BackgroundGradient = ({ hideOverlay, ...props }: any) => {
  const theme = useTheme();

  const colors = [
    theme.palette.primary.dark,
    theme.palette.secondary.main,
    "#06b6d4", // cyan.500 equivalent
    "#14b8a6", // teal.500 equivalent
  ];

  const fallbackBackground = `radial-gradient(at top left, ${colors[0]} 30%, transparent 80%), radial-gradient(at bottom, ${colors[1]} 0%, transparent 60%), radial-gradient(at bottom left, #06b6d4 0%, transparent 50%), radial-gradient(at top right, ${colors[3]}, transparent), radial-gradient(at bottom right, ${colors[0]} 0%, transparent 50%)`;

  const overlayColor = theme.palette.mode === "light" ? "white" : "#1a202c"; // gray.900 equivalent
  const gradientOverlay = `linear-gradient(0deg, ${overlayColor} 60%, rgba(0, 0, 0, 0) 100%)`;

  return (
    <Box
      sx={{
        backgroundImage: fallbackBackground,
        backgroundBlendMode: "saturation",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0,
        opacity: theme.palette.mode === "light" ? 0.3 : 0.5,
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        ...props.sx,
      }}
      {...props}
    >
      <Box
        sx={{
          backgroundImage: !hideOverlay ? gradientOverlay : undefined,
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 1,
        }}
      />
    </Box>
  );
};
