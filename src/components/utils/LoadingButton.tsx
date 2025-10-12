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
        minWidth: loading ? 120 : "auto",
        transition: "all 0.2s",
        "&.Mui-disabled": {
          opacity: 0.7,
        },
        ...sx,
      }}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
