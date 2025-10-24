"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Typography, Paper, Container, Alert, CircularProgress, List, ListItem, ListItemIcon, ListItemText, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { CheckCircle, Cancel, RestoreOutlined } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";

function AccountRecoveryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [actions, setActions] = useState<string[]>([]);

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    const processRecovery = async () => {
      if (!token || !email) {
        setError("Invalid recovery link. Please request a new account recovery email.");
        setProcessing(false);
        return;
      }

      try {
        const response = await fetch("/api/account-recovery/consume", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, email }),
        });

        const result = await response.json();

        if (result.success) {
          setSuccess(true);
          setActions(result.actions || []);
          setTimeout(() => {
            router.push("/login?recovery=success");
          }, 5000);
        } else {
          setError(result.message || "Failed to recover account");
        }
      } catch (err) {
        console.error("Recovery error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setProcessing(false);
      }
    };

    processRecovery();
  }, [token, email, router]);

  if (processing) {
    return (
      <>
        <BaseHeader />
        <Container component="main" maxWidth="sm">
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ textAlign: "center" }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Processing your account recovery...</Typography>
            </Box>
          </Box>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <BaseHeader />
        <Container component="main" maxWidth="sm">
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              py: 4,
            }}
          >
            <Paper elevation={3} sx={{ p: 4 }}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Cancel sx={{ fontSize: 64, color: "error.main" }} />
              </Box>
              <Typography component="h1" variant="h5" align="center" gutterBottom color="error">
                Recovery Failed
              </Typography>
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                This recovery link may have expired or already been used. Recovery links can only be used once and are valid for 24 hours.
              </Typography>
              <Button variant="contained" component={Link} href="/login" fullWidth>
                Go to Login
              </Button>
              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  Need help?{" "}
                  <MuiLink href="mailto:support@adhub.com" underline="hover">
                    Contact Support
                  </MuiLink>
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Container>
      </>
    );
  }

  if (success) {
    return (
      <>
        <BaseHeader />
        <Container component="main" maxWidth="sm">
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              py: 4,
            }}
          >
            <Paper elevation={3} sx={{ p: 4 }}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
              </Box>
              <Typography component="h1" variant="h5" align="center" gutterBottom color="success.main">
                Account Successfully Recovered!
              </Typography>
              <Alert severity="success" sx={{ mb: 3 }}>
                Your account has been successfully recovered. You can now sign in and access all features.
              </Alert>

              {actions.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Actions completed:
                  </Typography>
                  <List dense>
                    {actions.map((action, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <RestoreOutlined color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={action} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                Redirecting to login in a few seconds...
              </Typography>

              <Button variant="contained" component={Link} href="/login" fullWidth>
                Continue to Login
              </Button>
            </Paper>
          </Box>
        </Container>
      </>
    );
  }

  return null;
}

export default function AccountRecoveryPage() {
  return (
    <Suspense
      fallback={
        <Container component="main" maxWidth="sm">
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Box>
        </Container>
      }
    >
      <AccountRecoveryForm />
    </Suspense>
  );
}
