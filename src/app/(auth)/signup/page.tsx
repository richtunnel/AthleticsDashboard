"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, TextField, Typography, Paper, Container, Alert, Divider, Link as MuiLink, CircularProgress } from "@mui/material";
import { Google } from "@mui/icons-material";
import Link from "next/link";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import { AuthActionButton } from "@/components/auth/AuthActionButton";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const referrerEmail = searchParams.get("ref") ? decodeURIComponent(searchParams.get("ref")!) : null;

  const googleAuth = useAuthButton({
    callbackUrl,
    onError: (err) => setError(err),
  });

  const credentialsAuth = useAuthButton({
    callbackUrl,
    onError: (err) => setError(err),
  });

  const isLoading = googleAuth.loading || credentialsAuth.loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          referrerEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      // Auto-login after signup
      const signInResult = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (signInResult?.error) {
        setError("Account created but login failed. Please login manually.");
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      // Error handled by onError callback
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    try {
      await googleAuth.executeAction({ type: "google" });
    } catch (error) {
      // Error handled by onError callback
    }
  };

  return (
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
            Create Account
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Sign up for AD Hub
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <AuthActionButton fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleSignup} loading={googleAuth.loading} disabled={isLoading} sx={{ mb: 2 }}>
            Sign up with Google
          </AuthActionButton>

          <Divider sx={{ my: 2 }}>OR</Divider>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              size="small"
              margin="normal"
              required
              fullWidth
              id="name"
              label="Full Name"
              name="name"
              autoComplete="name"
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
            />
            <TextField
              size="small"
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isLoading}
            />
            <TextField
              size="small"
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isLoading}
              helperText="Must be at least 8 characters"
            />
            <TextField
              size="small"
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={isLoading}
            />
            <AuthActionButton type="submit" fullWidth variant="outlined" loading={credentialsAuth.loading} disabled={isLoading} sx={{ mt: 3, mb: 2 }}>
              Sign up with Email
            </AuthActionButton>

            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Typography variant="body2">
                Already have an account?{" "}
                <MuiLink component={Link} href="/login" underline="hover">
                  Log in
                </MuiLink>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default function SignUpWithPlan() {
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
      <SignupForm />
    </Suspense>
  );
}
