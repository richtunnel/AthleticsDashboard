"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Box, Typography, CircularProgress, Alert, Stack } from "@mui/material";
import { CalendarMonth, CheckCircleOutline, LinkOff } from "@mui/icons-material";
import { FaGoogle } from "react-icons/fa";

// Utility function to fetch connection status
const fetchConnectionStatus = async () => {
  const res = await fetch("/api/user/calendar-status");
  if (!res.ok) throw new Error("Failed to fetch calendar status");
  return res.json();
};

export function GoogleCalendarSyncMenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  // 1. Fetch the user's current connection status
  // This API endpoint (defined below) will check if the refresh token exists.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["calendarConnectionStatus"],
    queryFn: fetchConnectionStatus,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isConnected = data?.isConnected;

  // 2. Handle the redirect after successful OAuth completion
  useEffect(() => {
    if (searchParams.get("calendar_connected") === "true") {
      setConnectionMessage("Google Calendar connected successfully! You can now sync games.");
      refetch(); // Refresh the status after connection
      // Clean up the URL query parameter
      router.replace("/dashboard/games", undefined);
    }
  }, [searchParams, router, refetch]);

  const handleConnect = () => {
    // The link to the OAuth initiation route
    router.push("/api/auth/calendar-connect");
  };

  const handleDisconnect = async () => {
    // Call a new API endpoint to clear the refresh token from the database
    if (window.confirm("Are you sure you want to disconnect your Google Calendar?")) {
      try {
        await fetch("/api/user/calendar-disconnect", { method: "POST" });
        refetch();
        setConnectionMessage("Google Calendar disconnected.");
      } catch (error) {
        setConnectionMessage("Failed to disconnect calendar.");
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <CircularProgress size={20} />
        <Typography>Checking connection...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "white" }}>
      <Typography variant="h6" gutterBottom>
        Google Calendar Sync
      </Typography>

      {connectionMessage && (
        <Alert severity={isConnected ? "success" : "info"} sx={{ mb: 2 }}>
          {connectionMessage}
        </Alert>
      )}

      {isConnected ? (
        <Stack spacing={1}>
          <Typography color="success.main" sx={{ display: "flex", alignItems: "center", fontWeight: "bold" }}>
            <CheckCircleOutline sx={{ mr: 1 }} /> Connected
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Automatic and manual sync is enabled.
          </Typography>
          <Button variant="outlined" color="error" startIcon={<LinkOff />} onClick={handleDisconnect} sx={{ mt: 2, textTransform: "none", width: "fit-content" }}>
            Disconnect Calendar
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Connect your account to enable automatic and manual game synchronization.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<FaGoogle />} onClick={handleConnect} sx={{ mt: 2, textTransform: "none", width: "fit-content" }}>
            Connect Gmail Account
          </Button>
        </Stack>
      )}
    </Box>
  );
}
