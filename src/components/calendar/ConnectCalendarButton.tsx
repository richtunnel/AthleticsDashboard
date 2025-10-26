"use client";

import { Button, Alert, Box } from "@mui/material";
import { CalendarMonth, CheckCircle } from "@mui/icons-material";
import { useSearchParams } from "next/navigation";

interface ConnectCalendarButtonProps {
  isConnected: boolean;
}

export function ConnectCalendarButton({ isConnected }: ConnectCalendarButtonProps) {
  const searchParams = useSearchParams();

  const calendarConnected = searchParams.get("calendar") === "connected";
  const error = searchParams.get("error");

  const handleConnect = () => {
    window.location.href = "/api/auth/calendar-connect";
  };

  return (
    <Box sx={{ boxShadow: "none" }}>
      {calendarConnected && (
        <Alert severity="success" sx={{ mb: 2 }}>
          ✅ Google Calendar connected successfully!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to connect calendar: {error}
        </Alert>
      )}

      {isConnected ? (
        <Alert severity="success" icon={<CheckCircle />}>
          Your Google Calendar is connected
        </Alert>
      ) : (
        <Button variant="contained" startIcon={<CalendarMonth />} onClick={handleConnect} fullWidth>
          Connect Google Calendar
        </Button>
      )}
    </Box>
  );
}
