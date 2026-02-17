"use client";

import { useState } from "react";
import { Button, CircularProgress, Tooltip } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useMicrosoftCalendarConnection } from "@/hooks/useMicrosoftCalendarConnection";
import { ConnectMicrosoftCalendarDialog } from "./ConnectMicrosoftCalendarDialog";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { useTheme as customTheme } from "@mui/material/styles";

interface ConnectMicrosoftCalendarButtonProps {
  /**
   * Variant of the button
   */
  variant?: "text" | "outlined" | "contained";

  /**
   * Size of the button
   */
  size?: "small" | "medium" | "large";

  /**
   * Where to return after successful connection
   */
  returnTo?: string;

  /**
   * Full width button
   */
  fullWidth?: boolean;

  /**
   * Show icon in button
   */
  showIcon?: boolean;

  /**
   * Custom button text
   */
  buttonText?: string;
}

/**
 * Button component for connecting Microsoft Outlook Calendar
 *
 * Shows different states:
 * - Not connected: "Connect Microsoft Calendar"
 * - Connected: "Connected" with checkmark
 * - Loading: Spinner
 *
 * Opens dialog explaining permissions before redirecting to Microsoft
 */
export function ConnectMicrosoftCalendarButton({
  variant = "outlined",
  size = "medium",
  returnTo,
  fullWidth = false,
  showIcon = true,
  buttonText,
}: ConnectMicrosoftCalendarButtonProps) {
  const { isConnected, isLoading } = useMicrosoftCalendarConnection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const theme = customTheme();
  const { mode } = useTheme();

  const handleClick = () => {
    if (isConnected) {
      return; // Already connected, do nothing
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  // Determine button text
  const text = buttonText || (isConnected ? "Calendar Connected" : "Connect Microsoft Calendar");

  return (
    <>
      <Tooltip title={isConnected ? "Microsoft Calendar is connected" : "Connect to sync games with your Microsoft Outlook Calendar"}>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={isLoading || isConnected}
          fullWidth={fullWidth}
          startIcon={isLoading ? <CircularProgress size={20} /> : showIcon ? isConnected ? <CheckCircleIcon /> : <CalendarTodayIcon /> : undefined}
          color={isConnected ? "success" : "primary"}
          sx={{
            color: mode === "dark" ? "#000" : "#fff",
            ...(isConnected && {
              borderColor: "success.main",
              color: "success.main",
            }),
          }}
        >
          {text}
        </Button>
      </Tooltip>

      <ConnectMicrosoftCalendarDialog open={dialogOpen} onClose={handleClose} returnTo={returnTo} />
    </>
  );
}
