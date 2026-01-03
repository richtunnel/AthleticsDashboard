"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

function ContactsCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const returnTo = searchParams.get("returnTo") || "/dashboard/email-groups";

        if (error) {
          setStatus("error");
          setMessage(error === "access_denied" ? "You declined to grant contacts permissions" : `Authorization error: ${error}`);
          return;
        }

        if (!code || !state) {
          setStatus("error");
          setMessage("Invalid callback parameters");
          return;
        }

        const baseUrl = window.location.origin;
        const callbackUrl = `${baseUrl}/auth/contacts/callback?returnTo=${encodeURIComponent(returnTo)}`;

        const response = await fetch("/api/auth/google-contacts/callback", {
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
          setMessage(data.error || "Failed to connect Google Contacts");
          return;
        }

        queryClient.invalidateQueries({ queryKey: ["email-groups"], refetchType: "all" });

        setStatus("success");
        setMessage("Google Contacts connected successfully!");

        setTimeout(() => {
          router.push(returnTo);
        }, 1500);
      } catch (callbackError) {
        console.error("Contacts callback error:", callbackError);
        setStatus("error");
        setMessage("An unexpected error occurred");
      }
    };

    void handleCallback();
  }, [searchParams, router, queryClient]);

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
      <Box sx={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
        {status === "loading" && (
          <>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom>
              Connecting Google Contacts...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we complete the authorization
            </Typography>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircleIcon sx={{ fontSize: 80, color: "success.main", mb: 2 }} />
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
            <ErrorIcon sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Connection Failed
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
              {message}
            </Alert>
            <Button variant="contained" onClick={() => router.push("/dashboard/email-groups")} fullWidth>
              Return to Email Groups
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

export default function ContactsCallbackPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <ContactsCallbackContent />
    </Suspense>
  );
}
