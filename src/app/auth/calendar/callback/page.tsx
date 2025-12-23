"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, CircularProgress, Typography, Alert, Button } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Google Calendar OAuth Callback Handler
 * 
 * Handles the OAuth callback from Google after user grants calendar permissions
 */
function CalendarCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get OAuth parameters from URL
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const returnTo = searchParams.get("returnTo") || "/dashboard/games";

        // Check for OAuth errors
        if (error) {
          setStatus("error");
          setMessage(
            error === "access_denied"
              ? "You declined to grant calendar permissions"
              : `Authorization error: ${error}`
          );
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setStatus("error");
          setMessage("Invalid callback parameters");
          return;
        }

        // Call backend API to complete authorization
        const baseUrl = window.location.origin;
        const callbackUrl = `${baseUrl}/auth/calendar/callback?returnTo=${encodeURIComponent(returnTo)}`;
        
        const response = await fetch("/api/auth/google-calendar/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
            redirectUrl: callbackUrl,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setStatus("error");
          setMessage(data.error || "Failed to connect Google Calendar");
          return;
        }

        // Success!
        setStatus("success");
        setMessage("Google Calendar connected successfully!");

        // Invalidate calendar connection status query to update all components
        queryClient.invalidateQueries({ queryKey: ["googleCalendarStatus"] });

        // Redirect after 2 seconds
        setTimeout(() => {
          router.push(returnTo);
        }, 2000);
      } catch (error) {
        console.error("Callback error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 500,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom>
              Connecting Google Calendar...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we complete the authorization
            </Typography>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircleIcon
              sx={{
                fontSize: 80,
                color: "success.main",
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom>
              Successfully Connected!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Redirecting you back...
            </Typography>
          </>
        )}

        {status === "error" && (
          <>
            <ErrorIcon
              sx={{
                fontSize: 80,
                color: "error.main",
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom>
              Connection Failed
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
              {message}
            </Alert>
            <Button
              variant="contained"
              onClick={() => router.push("/dashboard/games")}
              fullWidth
            >
              Return to Dashboard
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function CalendarCallbackPage() {
  return (
    <Suspense fallback={
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    }>
      <CalendarCallbackContent />
    </Suspense>
  );
}
