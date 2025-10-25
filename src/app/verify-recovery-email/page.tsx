"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, Card, CardContent, Typography, CircularProgress, Alert, Button } from "@mui/material";
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon } from "@mui/icons-material";

export default function VerifyRecoveryEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch("/api/recovery-email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Verification failed");
        }

        setStatus("success");
        setMessage("Your recovery email has been verified successfully!");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Failed to verify recovery email");
      }
    };

    verifyToken();
  }, [token]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ maxWidth: 500, width: "100%" }}>
        <CardContent sx={{ textAlign: "center", py: 4 }}>
          {status === "loading" && (
            <>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6">Verifying recovery email...</Typography>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircleIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Email Verified!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {message}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push("/dashboard/settings")}
              >
                Go to Settings
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <ErrorIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Verification Failed
              </Typography>
              <Alert severity="error" sx={{ mb: 3 }}>
                {message}
              </Alert>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push("/dashboard/settings")}
              >
                Go to Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
