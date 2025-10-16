"use client";

import { Button, Alert } from "@mui/material";
import { CalendarMonth, CheckCircle } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function ConnectCalendarButton() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const calendarConnected = searchParams.get("calendar") === "connected";
  const error = searchParams.get("error");

  const handleConnect = () => {
    // This will redirect to your calendar-connect endpoint
    window.location.href = "/api/auth/calendar-connect";
  };

  if (!session) {
    return <Alert severity="warning">Please log in to connect your Google Calendar</Alert>;
  }

  return (
    <div>
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

      <Button variant="contained" startIcon={<CalendarMonth />} onClick={handleConnect} fullWidth>
        Connect Google Calendar
      </Button>
    </div>
  );
}
