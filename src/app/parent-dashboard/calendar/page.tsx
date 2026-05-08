"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Button,
  Alert,
  Stack,
  Skeleton,
  CircularProgress,
} from "@mui/material";
import { CalendarMonth, LinkOff, SyncLock } from "@mui/icons-material";
import { FaGoogle } from "react-icons/fa";
import { CalendarGroupMappings } from "@/components/calendar/CalendarGroupMappings";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";

/** Fetch calendar connection status scoped to the parent session */
const fetchCalendarStatus = async () => {
  const res = await fetch("/api/user/calendar-status");
  if (!res.ok) return { isConnected: false, connectedEmail: null };
  return res.json();
};

/** Handles the ?calendar=connected redirect after OAuth */
function CalendarConnectionHandler({ refetch }: { refetch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const param = searchParams.get("calendar");
    const calendarConnected = searchParams.get("calendar_connected");
    if (param === "connected" || calendarConnected === "true") {
      setSuccessMsg("Google Calendar connected successfully!");
      refetch();
      router.replace("/parent-dashboard/calendar");
    }
  }, [searchParams, router, refetch]);

  if (!successMsg) return null;
  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      {successMsg}
    </Alert>
  );
}

function ParentCalendarPageContent() {
  const queryClient = useQueryClient();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { connect, isLoading: isConnecting } = useGoogleCalendarConnection();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["parentCalendarStatus"],
    queryFn: fetchCalendarStatus,
    staleTime: 5 * 60 * 1000,
  });

  const isConnected = data?.isConnected ?? false;
  const connectedEmail = data?.connectedEmail ?? null;

  const handleConnect = async () => {
    try {
      setConnectError(null);
      await connect("/parent-dashboard/calendar");
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Failed to connect Google Calendar"
      );
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect your Google Calendar? You can reconnect at any time."
      )
    )
      return;
    try {
      setIsDisconnecting(true);
      await fetch("/api/auth/google-calendar/disconnect", { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["parentCalendarStatus"] });
      queryClient.invalidateQueries({ queryKey: ["googleCalendarStatus"] });
      refetch();
    } catch (error) {
      console.error("Failed to disconnect calendar:", error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          p: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Skeleton variant="text" width={240} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Google Calendar Sync
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Connect your Google Calendar so approved game schedules sync
          automatically.
        </Typography>
      </Box>

      {/* Connection card */}
      <Box
        sx={{
          p: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          mb: 4,
        }}
      >
        <Typography variant="h5" gutterBottom>
          Google Calendar
        </Typography>

        {/* OAuth success handler */}
        <Suspense fallback={null}>
          <CalendarConnectionHandler refetch={refetch} />
        </Suspense>

        {isConnected ? (
          <Stack spacing={2}>
            <Alert severity="success" icon={<SyncLock />}>
              Your Google Calendar is connected
              {connectedEmail && (
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 0.25,
                    color: "success.dark",
                    opacity: 0.85,
                  }}
                >
                  {connectedEmail}
                </Typography>
              )}
            </Alert>

            <Typography variant="body2" color="text.secondary">
              Once the Athletic Director approves your calendar sync request,
              games will automatically appear in your Google Calendar.
            </Typography>

            <Box
              sx={{
                pt: 2,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Button
                variant="outlined"
                color="error"
                startIcon={
                  isDisconnecting ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <LinkOff />
                  )
                }
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                sx={{ textTransform: "none" }}
              >
                {isDisconnecting ? "Disconnecting…" : "Disconnect Calendar"}
              </Button>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Connect your Google account to enable automatic game sync. Once
              the Athletic Director approves your request, games will
              appear in your calendar automatically.
            </Typography>

            {connectError && (
              <Alert severity="error" onClose={() => setConnectError(null)}>
                {connectError}
              </Alert>
            )}

            <Button
              variant="contained"
              color="primary"
              startIcon={
                isConnecting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <FaGoogle />
                )
              }
              onClick={handleConnect}
              disabled={isConnecting}
              sx={{ textTransform: "none", width: "fit-content" }}
            >
              {isConnecting ? "Connecting…" : "Connect Google Calendar"}
            </Button>
          </Stack>
        )}
      </Box>

      {/* Calendar Group Mappings — only shown when connected */}
      {isConnected && (
        <Box
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          {/* Pass the verified calendar email so CalendarGroupMappings
              never falls back to the sign-in email from useSession */}
          <CalendarGroupMappings connectedEmailOverride={connectedEmail} />
        </Box>
      )}
    </Box>
  );
}

export default function ParentCalendarPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Skeleton variant="text" width={240} height={40} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </Box>
      }
    >
      <ParentCalendarPageContent />
    </Suspense>
  );
}
