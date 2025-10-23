"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, TextField, Typography, Paper, Container, Alert, Divider, Link as MuiLink, CircularProgress } from "@mui/material";
import { Google } from "@mui/icons-material";
import Link from "next/link";
import BaseHeader from "@/components/headers/_base";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const errorParam = searchParams.get("error");
  const resetSuccess = searchParams.get("reset");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Please enter your email and password");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "No user found with this email") {
          setError("No account found with this email. Please sign up first.");
        } else if (result.error === "Please sign in with Google") {
          setError("This account uses Google sign-in. Please use the Google button below.");
        } else if (result.error === "Invalid password") {
          setError("Incorrect password");
        } else {
          setError("Invalid email or password");
        }
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    signIn("google", {
      callbackUrl,
    });
  };

  const displayError = error || (errorParam === "OAuthSignin" ? "Failed to sign in with Google. Please try again." : "");

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />

      <Container component="main" maxWidth="xs">
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
            <Typography component="h1" variant="h5" align="center" gutterBottom>
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Welcome back to the Hub
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

            <Button fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleLogin} disabled={loading || googleLoading} sx={{ mb: 2 }}>
              {googleLoading ? <CircularProgress size={24} /> : "Sign in with Google"}
            </Button>

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
                disabled={loading}
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
                disabled={loading}
              />

              <Box sx={{ mt: 1, textAlign: "right" }}>
                <MuiLink component={Link} href="/forgot-password" variant="body2" underline="hover">
                  Forgot password?
                </MuiLink>
              </Box>

              <Button type="submit" fullWidth variant="outlined" sx={{ mt: 2, mb: 2 }} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : "Sign in with Email"}
              </Button>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  Don't have an account?{" "}
                  <MuiLink component={Link} href="/signup" underline="hover">
                    Sign up
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    </>
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
