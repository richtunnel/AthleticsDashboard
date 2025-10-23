import { Button, CircularProgress, type SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { ReactNode } from "react";

interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  variant?: "text" | "outlined" | "contained";
  color?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  sx?: SxProps<Theme>;
  loadingText?: string;
}

export function LoadingButton({
  loading = false,
  disabled = false,
  onClick,
  children,
  startIcon,
  endIcon,
  variant = "contained",
  color = "primary",
  size = "medium",
  fullWidth = false,
  type = "button",
  sx,
  loadingText,
  ...props
}: LoadingButtonProps) {
  const isDisabled = loading || disabled;

  const baseStyles: SxProps<Theme> = (theme) => {
    const primary = theme.palette.primary.main;

    return {
      boxShadow: "none",
      borderRadius: 10,
      fontWeight: 600,
      transition: "background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      backgroundColor:
        variant === "contained"
          ? theme.palette.mode === "dark"
            ? alpha(primary, 0.35)
            : alpha(primary, 0.92)
          : theme.palette.mode === "dark"
            ? alpha("#FFFFFF", 0.08)
            : alpha(primary, 0.1),
      color: variant === "contained" ? theme.palette.primary.contrastText : theme.palette.text.primary,
      border:
        variant === "outlined"
          ? `1.5px solid ${alpha(primary, 0.45)}`
          : variant === "text"
            ? "none"
            : `1px solid ${alpha(primary, theme.palette.mode === "dark" ? 0.45 : 0.25)}`,
      "&:hover": {
        backgroundColor:
          variant === "contained"
            ? theme.palette.mode === "dark"
              ? alpha(primary, 0.45)
              : theme.palette.primary.dark
            : variant === "outlined"
              ? alpha(primary, theme.palette.mode === "dark" ? 0.35 : 0.18)
              : alpha(primary, theme.palette.mode === "dark" ? 0.2 : 0.12),
        boxShadow: theme.palette.mode === "dark" ? "0 18px 42px rgba(8, 15, 35, 0.5)" : "0 16px 36px rgba(65, 105, 225, 0.25)",
      },
      "&:disabled": {
        opacity: 0.6,
        boxShadow: "none",
      },
    };
  };

  const combinedSx: SxProps<Theme> = Array.isArray(sx) ? [baseStyles, ...sx] : sx ? [baseStyles, sx] : [baseStyles];

  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
      endIcon={!loading ? endIcon : undefined}
      sx={combinedSx}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
