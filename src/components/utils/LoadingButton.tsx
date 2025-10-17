"use client";

import { Button, CircularProgress } from "@mui/material";
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
  sx?: any;
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
      sx={{
        backgroundColor: "#d3dbe2!important",
        boxShadow: "none",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "inherit",
        fontWeight: "600",
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.1)", // subtle hover effect
          boxShadow: "none",
        },
        ...sx,
      }}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
