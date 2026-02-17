"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, TextField, Typography, Paper, Container, Alert, Divider, Link as MuiLink, CircularProgress } from "@mui/material";
import { Google } from "@mui/icons-material";
import Link from "next/link";
import BaseHeader from "@/components/headers/_base";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import { useSession } from "next-auth/react";
import Footer from "@/components/layout/Footer";
import TopFooter from "@/components/footer/topFooter";

// Microsoft icon component
function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" width="20" height="20">
      <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const errorParam = searchParams.get("error");
  const resetSuccess = searchParams.get("reset");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push(callbackUrl);
    }
  }, [status, session, router, callbackUrl]);

  const googleAuth = useAuthButton({
    callbackUrl,
    onError: (err) => setError(err),
  });

  const microsoftAuth = useAuthButton({
    callbackUrl,
    onError: (err) => setError(err),
  });

  const credentialsAuth = useAuthButton({
    callbackUrl,
    onError: (err) => {
      if (err === "No user found with this email") {
        setError("No account found with this email. Please sign up first.");
      } else if (err === "Please sign in with Google") {
        setError("This account uses Google sign-in. Please use the Google button below.");
      } else if (err === "Invalid password") {
        setError("Incorrect password");
      } else {
        setError("Invalid email or password");
      }
    },
  });

  const isLoading = googleAuth.loading || microsoftAuth.loading || credentialsAuth.loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Please enter your email and password");
      return;
    }

    try {
      await credentialsAuth.executeAction({
        type: "credentials",
        credentials: {
          email: formData.email,
          password: formData.password,
        },
      });
    } catch (error) {
      // Error already handled by onError callback
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      // For sign-in, directly trigger Google OAuth without consent page
      // Existing users don't need to see calendar permissions explanation again
      await googleAuth.executeAction({
        type: "google",
      });
    } catch (error) {
      // Error already handled by onError callback
    }
  };

  const handleMicrosoftLogin = async () => {
    setError("");
    try {
      // For sign-in, directly trigger Microsoft OAuth without consent page
      // Existing users don't need to see calendar permissions explanation again
      await microsoftAuth.executeAction({
        type: "azure-ad",
      });
    } catch (error) {
      // Error already handled by onError callback
    }
  };

  const displayError = error || (errorParam === "OAuthSignin" ? "No account found with this Google account. Please sign up first." : "");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />

      <Container component="main" maxWidth="xs" sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            py: 4,
          }}
        >
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography component="h1" variant="h5" align="center" gutterBottom>
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Welcome back to Opletics
            </Typography>

            {resetSuccess === "success" && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Your password has been reset successfully! You can now sign in with your new password.
              </Alert>
            )}

            {displayError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {displayError}
              </Alert>
            )}

            <AuthActionButton fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleLogin} loading={googleAuth.loading} disabled={isLoading} sx={{ mb: 1 }}>
              Sign in with Google
            </AuthActionButton>
            <AuthActionButton fullWidth variant="contained" startIcon={<MicrosoftIcon />} onClick={handleMicrosoftLogin} loading={microsoftAuth.loading} disabled={isLoading} sx={{ mb: 2 }}>
              Sign in with Microsoft
            </AuthActionButton>

            <Divider sx={{ my: 2 }}>OR</Divider>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                size="small"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLoading}
              />
              <TextField
                margin="normal"
                size="small"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                disabled={isLoading}
              />

              <Box sx={{ mt: 1, textAlign: "right" }}>
                <MuiLink component={Link} href="/forgot-password" variant="body2" underline="hover">
                  Forgot password?
                </MuiLink>
              </Box>

              <AuthActionButton type="submit" fullWidth variant="outlined" loading={credentialsAuth.loading} disabled={isLoading} sx={{ mt: 2, mb: 2 }}>
                Sign in with Email
              </AuthActionButton>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  Don't have an account?{" "}
                  <MuiLink component={Link} href="/onboarding/plans" underline="hover">
                    Sign up
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
      <TopFooter />
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Container component="main" maxWidth="xs">
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
      <LoginForm />
    </Suspense>
  );
}
