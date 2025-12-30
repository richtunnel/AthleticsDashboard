"use client";

import { Card, CardContent, Typography, Box, Button, Alert } from "@mui/material";
import { ConnectGoogleCalendarButton } from "@/components/auth/ConnectGoogleCalendarButton";
import { AutoCalendarSyncToggle } from "@/components/settings/AutoCalendarSyncToggle";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";

/**
 * Settings section for managing Google Calendar connection
 *
 * Features:
 * - Connect/disconnect Google Calendar
 * - Shows connection status
 * - Auto-sync toggle (when connected)
 * - Uses incremental OAuth authorization
 */
export function CalendarConnectionSection() {
  const { isConnected, isLoading, disconnect } = useGoogleCalendarConnection();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Calendar? You can reconnect anytime.")) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Card sx={{ mb: 3, boxShadow: "none!important" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
          Google Calendar Integration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          Connect your Google Calendar to automatically sync games and events.
        </Typography>

        {/* Connection Status */}
        {isConnected && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            Google Calendar is connected and ready to sync
          </Alert>
        )}

        {!isConnected && !isLoading && (
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
            Connect Google Calendar to enable automatic game syncing
          </Alert>
        )}

        {/* Connection Actions */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {!isConnected ? (
            <ConnectGoogleCalendarButton variant="contained" size="medium" returnTo="/dashboard/settings" />
          ) : (
            <Button
              sx={(theme) => ({
                // color: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
              })}
              variant="outlined"
              color="error"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect Calendar"}
            </Button>
          )}
        </Box>

        {/* Auto-Sync Toggle (only when connected) */}
        {isConnected && (
          <Box sx={{ mt: 3, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
            <AutoCalendarSyncToggle />
          </Box>
        )}

        {/* Help Text */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {isConnected
              ? "You can disconnect your calendar anytime. Existing calendar events will remain until manually deleted."
              : "Connecting allows you to sync games to your calendar with one click. You'll be asked to grant permissions via Google."}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
