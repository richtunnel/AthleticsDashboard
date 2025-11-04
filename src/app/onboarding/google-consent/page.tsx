"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, Paper, Container, List, ListItem, ListItemIcon, ListItemText, Alert, CircularProgress } from "@mui/material";
import { Google, CalendarMonth, Edit, Delete, Add, Security } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import Footer from "@/components/layout/Footer";

function GoogleConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const mode = searchParams.get("mode") || "signup";

  const googleAuth = useAuthButton({
    callbackUrl,
    onError: (err) => setError(err),
  });

  const handleContinueWithGoogle = async () => {
    setError("");
    try {
      await googleAuth.executeAction({ type: "google" });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  const handleGoBack = () => {
    if (mode === "login") {
      router.push("/login");
    } else {
      router.push("/onboarding/signup");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />

      <Container component="main" maxWidth="md" sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", py: 4 }}>
        <Paper elevation={3} sx={{ p: { xs: 3, md: 5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", mb: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                bgcolor: "primary.light",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <CalendarMonth sx={{ fontSize: 48, color: "primary.main" }} />
            </Box>
          </Box>

          <Typography component="h1" variant="h4" align="center" gutterBottom sx={{ fontWeight: "bold" }}>
            Calendar Integration Permissions
          </Typography>

          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4, fontSize: "1.1rem" }}>
            ADHub needs access to your Google Calendar to sync your game schedule seamlessly
          </Typography>

          <Alert severity="info" sx={{ mb: 4 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
              Why we need these permissions:
            </Typography>
            <Typography variant="body2">
              To provide you with automatic calendar synchronization and keep your schedule up-to-date across all your devices, ADHub requires certain Google Calendar permissions.
            </Typography>
          </Alert>

          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: "bold" }}>
            What ADHub will be able to do:
          </Typography>

          <List sx={{ mb: 3 }}>
            <ListItem sx={{ py: 2 }}>
              <ListItemIcon>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: "success.light",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Add sx={{ color: "success.main" }} />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Create Events</Typography>}
                secondary="Automatically add games and events to your Google Calendar when you schedule them in ADHub"
              />
            </ListItem>

            <ListItem sx={{ py: 2 }}>
              <ListItemIcon>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: "warning.light",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Edit sx={{ color: "warning.main" }} />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Edit Events</Typography>}
                secondary="Update game times, locations, and details in your calendar when you make changes in ADHub"
              />
            </ListItem>

            <ListItem sx={{ py: 2 }}>
              <ListItemIcon>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    bgcolor: "error.light",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Delete sx={{ color: "error.main" }} />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Delete Events</Typography>}
                secondary="Remove cancelled games from your calendar automatically when you delete them in ADHub"
              />
            </ListItem>
          </List>

          <Alert severity="success" icon={<Security />} sx={{ mb: 4 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
              Your data is secure
            </Typography>
            <Typography variant="body2">
              We only access calendar events that ADHub creates. Your personal calendar data remains private, and you can revoke these permissions at any time from your Google account settings.
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <AuthActionButton
              fullWidth
              variant="contained"
              size="large"
              startIcon={<Google />}
              onClick={handleContinueWithGoogle}
              loading={googleAuth.loading}
              sx={{ py: 1.5 }}
            >
              Continue with Google
            </AuthActionButton>

            <AuthActionButton
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleGoBack}
              disabled={googleAuth.loading}
              sx={{ py: 1.5 }}
            >
              Go Back
            </AuthActionButton>
          </Box>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
            By continuing, you agree to grant ADHub the necessary permissions to manage your calendar events.
          </Typography>
        </Paper>
      </Container>

      <Footer />
    </Box>
  );
}

export default function GoogleConsentPage() {
  return (
    <Suspense
      fallback={
        <Container component="main" maxWidth="md">
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
      <GoogleConsentForm />
    </Suspense>
  );
}
