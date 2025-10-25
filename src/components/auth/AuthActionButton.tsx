import { Button, CircularProgress, type SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { ReactNode } from "react";

interface AuthActionButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
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

export function AuthActionButton({
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
}: AuthActionButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      startIcon={loading ? undefined : startIcon}
      endIcon={!loading ? endIcon : undefined}
      sx={sx}
    >
      {loading ? <CircularProgress size={20} color="inherit" /> : loadingText ? loadingText : children}
    </Button>
  );
}
