"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Box, Typography, CircularProgress, Alert, Stack, Skeleton } from "@mui/material";
import { CalendarMonth, CheckCircleOutline, CheckCircle, LinkOff, SyncLock } from "@mui/icons-material";
import { FaGoogle } from "react-icons/fa";
import { IconButton } from "@mui/material";
import styles from "@/styles/override.module.css";
import Link from "next/link";
import { AutoCalendarSyncToggle } from "@/components/settings/AutoCalendarSyncToggle";
import { CalendarGroupMappings } from "@/components/calendar/CalendarGroupMappings";
import { useTheme as customTheme } from "@mui/material/styles";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";

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
    if (searchParams.get("calendar_connected") === "true" || searchParams.get("calendar") === "connected") {
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
  const theme = customTheme();
  const [connectError, setConnectError] = useState<string | null>(null);
  // Anchor for the first-login Connect-Calendar TipBubble. Only used while
  // `isConnected === false`, so it auto-disappears once the user finishes the
  // OAuth flow.
  const [connectBtnEl, setConnectBtnEl] = useState<HTMLButtonElement | null>(null);

  // Fetch the user's current connection status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["calendarConnectionStatus"],
    queryFn: fetchConnectionStatus,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { connect, isLoading: isConnecting } = useGoogleCalendarConnection();

  const isConnected = data?.isConnected;
  const connectedEmail = data?.connectedEmail ?? null;

  const handleConnect = async () => {
    try {
      setConnectError(null);
      await connect("/dashboard/gsync");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect Google Calendar");
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm("Are you sure you want to disconnect your Google Calendar?")) {
      trackEvent("Calendar Disconnect Clicked", {
        source: "calendar_sync_page",
        action: "disconnect_calendar",
      });

      try {
        await fetch("/api/auth/google-calendar/disconnect", { method: "POST" });
        refetch();
      } catch (error) {
        console.error("Failed to disconnect calendar:", error);
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
      <Typography variant="h4" fontWeight={700}>Google Calendar Sync</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1, maxWidth: 960 }}>
        Google Calendar Sync imports your uploaded game schedule directly into your Google Calendar so you always have your events on your phone, in your inbox reminders, and accessible from any
        device.
      </Typography>
      <Typography variant="overline" gutterBottom style={{ color: "text.primary" }}>
        <Link href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
          View Calendar
        </Link>
      </Typography>

      {/* Connection message handler wrapped in Suspense */}
      <Suspense fallback={<ConnectionHandlerFallback />}>
        <CalendarConnectionHandler refetch={refetch} />
      </Suspense>

      {isConnected ? (
        <Stack spacing={2}>
          <Box sx={{ width: "100%", maxWidth: "1280px" }}>
            <Alert sx={{ width: "100%" }} severity="success" icon={<SyncLock />}>
              Your Google Calendar is connected
              {connectedEmail && (
                <Typography variant="caption" sx={{ display: "block", mt: 0.25, color: "success.dark", opacity: 0.85 }}>
                  {connectedEmail}
                </Typography>
              )}
            </Alert>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Manual sync is always available from the games table.
          </Typography>
          <Box sx={{ pt: 2, pb: 1, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ pb: 2 }}>
              Calendar Sync Options
            </Typography>

            <AutoCalendarSyncToggle />
            <Button
              variant="outlined"
              color="primary"
              startIcon={<LinkOff sx={{ color: "#10a37f" }} />}
              onClick={handleDisconnect}
              sx={{
                color: theme.palette.mode === "dark" ? theme.palette.themeText.text : theme.palette.themeButtonText.main,
                backgroundColor: theme.palette.mode === "light" ? "rgb(24 27 56)" : "",
                borderColor: theme.palette.themeButtonText.subtle,
                textTransform: "none",
                width: "fit-content",
                mt: 2,
              }}
            >
              Disconnect Calendar
            </Button>
          </Box>

          <Box sx={{ pt: 2, pb: 1, borderTop: "1px solid", borderColor: "divider" }}>
            <CalendarGroupMappings />
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Connect your gmail account to enable game synchronization and add games to your personal calendar with a single click.
          </Typography>
          {connectError && (
            <Alert severity="error" onClose={() => setConnectError(null)}>
              {connectError}
            </Alert>
          )}
          <Button
            ref={setConnectBtnEl}
            variant="contained"
            color="primary"
            startIcon={isConnecting ? <CircularProgress size={16} color="inherit" /> : <FaGoogle />}
            onClick={handleConnect}
            disabled={isConnecting}
            sx={{ mt: 2, textTransform: "none", width: "fit-content" }}
          >
            {isConnecting ? "Connecting..." : "Connect Google Calendar"}
          </Button>
          <TipBubble
            tipId={TIP_IDS.CALENDAR_CONNECT}
            anchorEl={connectBtnEl}
            placement="bottom-start"
            title="Connect your Google Calendar"
            body="Link your Google Calendar to sync your imported spreadsheet so every game lands on your calendar automatically."
          />
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
        <Box sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </Box>
      }
    >
      <GoogleCalendarSyncMenuContent />
    </Suspense>
  );
}
