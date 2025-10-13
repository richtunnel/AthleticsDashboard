"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Box, Typography, CircularProgress, Alert, Stack, Skeleton } from "@mui/material";
import { CalendarMonth, CheckCircleOutline, LinkOff } from "@mui/icons-material";
import { FaGoogle } from "react-icons/fa";

// Utility function to fetch connection status
const fetchConnectionStatus = async () => {
  const res = await fetch("/api/user/calendar-status");
  if (!res.ok) throw new Error("Failed to fetch calendar status");
  return res.json();
};

// Separate component that uses useSearchParams
function CalendarConnectionHandler({ refetch }: { refetch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("calendar_connected") === "true") {
      setConnectionMessage("Google Calendar connected successfully! You can now sync games.");
      refetch();
      router.replace("/dashboard/gsync");
    }
  }, [searchParams, router, refetch]);

  if (!connectionMessage) return null;

  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      {connectionMessage}
    </Alert>
  );
}

// Loading fallback for Suspense
function ConnectionHandlerFallback() {
  return null; // Or return a skeleton/loading state if you prefer
}

// Main component
function GoogleCalendarSyncMenuContent() {
  const router = useRouter();

  // Fetch the user's current connection status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["calendarConnectionStatus"],
    queryFn: fetchConnectionStatus,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isConnected = data?.isConnected;

  const handleConnect = () => {
    router.push("/api/auth/calendar-connect");
  };

  const handleDisconnect = async () => {
    if (window.confirm("Are you sure you want to disconnect your Google Calendar?")) {
      try {
        await fetch("/api/user/calendar-disconnect", { method: "POST" });
        refetch();
      } catch (error) {
        console.error("Failed to disconnect calendar:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "white" }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "white" }}>
      <Typography variant="h6" gutterBottom>
        Google Calendar Sync
      </Typography>

      {/* Connection message handler wrapped in Suspense */}
      <Suspense fallback={<ConnectionHandlerFallback />}>
        <CalendarConnectionHandler refetch={refetch} />
      </Suspense>

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

// Export with Suspense wrapper
export function GoogleCalendarSyncMenu() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 3, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "white" }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </Box>
      }
    >
      <GoogleCalendarSyncMenuContent />
    </Suspense>
  );
}
