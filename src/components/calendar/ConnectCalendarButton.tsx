"use client";

import { Button, Alert, Box } from "@mui/material";
import { CalendarMonth, CheckCircle } from "@mui/icons-material";
import { useSearchParams } from "next/navigation";
import SyncIcon from "@mui/icons-material/Sync";
interface ConnectCalendarButtonProps {
  isConnected: boolean;
}

export function ConnectCalendarButton({ isConnected }: ConnectCalendarButtonProps) {
  const searchParams = useSearchParams();

  const calendarConnected = searchParams.get("calendar") === "connected";
  const error = searchParams.get("error");

  const handleConnect = () => {
    window.location.href = "/api/auth/calendar-connect?returnTo=/dashboard/gsync";
  };

  return (
    <Box>
      {calendarConnected && (
        <Alert severity="success" sx={{ mb: 2, boxShadow: "none" }}>
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
        <Button variant="contained" startIcon={<SyncIcon />} onClick={handleConnect}>
          Connect Google Calendar
        </Button>
      )}
    </Box>
  );
}
