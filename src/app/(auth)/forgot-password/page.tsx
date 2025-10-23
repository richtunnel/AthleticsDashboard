"use client";

import { useState } from "react";
import { Box, Button, TextField, Typography, Paper, Container, Alert, CircularProgress, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { ArrowBack } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const result = await requestPasswordReset(email);

      if (result.success) {
        setSuccess(true);
        setEmail("");
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Container sx={{ top: "-75px", position: "relative" }} component="main" maxWidth="xs">
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            py: 4,
          }}
        >
          <Box sx={{ mb: 3 }}>
            {/* <MuiLink
                component={Link}
                href="/login"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: "text.secondary",
                  "&:hover": { color: "primary.main" },
                }}
              >
                <ArrowBack sx={{ mr: 1, fontSize: 20 }} />
                Back to Login
              </MuiLink> */}
          </Box>

          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Forgot Password
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Enter your email address and we'll send you a link to reset your password
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Check your email! If an account exists with this email, you will receive a password reset link shortly.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!success && (
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : "Send Reset Link"}
              </Button>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  <MuiLink component={Link} href="/login" underline="hover">
                    Back to Sign in ?
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          )}

          {success && (
            <Box sx={{ mt: 3, textAlign: "center" }}>
              <Button variant="outlined" component={Link} href="/login" fullWidth>
                Return to Login
              </Button>
            </Box>
          )}
        </Box>
      </Container>
    </>
  );
}
