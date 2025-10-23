"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, TextField, Typography, Paper, Container, Alert, CircularProgress, LinearProgress, Link as MuiLink } from "@mui/material";
import Link from "next/link";
import { CheckCircle, Cancel, Visibility, VisibilityOff } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import { validateResetToken, resetPassword } from "./actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    const checkToken = async () => {
      if (!token || !email) {
        setError("Invalid reset link. Please request a new password reset.");
        setValidatingToken(false);
        setTokenValid(false);
        return;
      }

      const result = await validateResetToken(token, email);
      setValidatingToken(false);

      if (result.valid) {
        setTokenValid(true);
      } else {
        setError(result.message || "Invalid or expired reset link");
        setTokenValid(false);
      }
    };

    checkToken();
  }, [token, email]);

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;

    if (strength < 40) return { strength, label: "Weak", color: "#ef4444" };
    if (strength < 70) return { strength, label: "Fair", color: "#f59e0b" };
    if (strength < 90) return { strength, label: "Good", color: "#10b981" };
    return { strength: 100, label: "Strong", color: "#10b981" };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.newPassword || !formData.confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token || !email) {
      setError("Invalid reset link");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(token, email, formData.newPassword, formData.confirmPassword);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login?reset=success");
        }, 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <>
        <BaseHeader />
        <Container component="main" maxWidth="xs">
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
              <Typography>Validating reset link...</Typography>
            </Box>
          </Box>
        </Container>
      </>
    );
  }

  if (!tokenValid) {
    return (
      <>
        <BaseHeader />
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
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Cancel sx={{ fontSize: 64, color: "error.main" }} />
              </Box>
              <Typography component="h1" variant="h5" align="center" gutterBottom color="error">
                Invalid Reset Link
              </Typography>
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
              <Button variant="contained" component={Link} href="/forgot-password" fullWidth>
                Request New Reset Link
              </Button>
              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  <MuiLink component={Link} href="/login" underline="hover">
                    Back to Login
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
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <CheckCircle sx={{ fontSize: 64, color: "success.main" }} />
              </Box>
              <Typography component="h1" variant="h5" align="center" gutterBottom color="success.main">
                Password Reset Successful!
              </Typography>
              <Alert severity="success" sx={{ mb: 3 }}>
                Your password has been successfully reset. Redirecting to login...
              </Alert>
              <Button variant="contained" component={Link} href="/login" fullWidth>
                Go to Login
              </Button>
            </Paper>
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <BaseHeader />
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
              Reset Your Password
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Enter your new password below
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                size="small"
                required
                fullWidth
                name="newPassword"
                label="New Password"
                type={showPassword ? "text" : "password"}
                id="newPassword"
                autoComplete="new-password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <Button
                      onClick={() => setShowPassword(!showPassword)}
                      sx={{ minWidth: "auto", p: 1 }}
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </Button>
                  ),
                }}
              />

              {formData.newPassword && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Password Strength:
                    </Typography>
                    <Typography variant="caption" sx={{ color: passwordStrength.color, fontWeight: 600 }}>
                      {passwordStrength.label}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={passwordStrength.strength}
                    sx={{
                      height: 6,
                      borderRadius: 1,
                      backgroundColor: "#e0e0e0",
                      "& .MuiLinearProgress-bar": {
                        backgroundColor: passwordStrength.color,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    Must be at least 8 characters with letters and numbers
                  </Typography>
                </Box>
              )}

              <TextField
                margin="normal"
                size="small"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm New Password"
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <Button
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      sx={{ minWidth: "auto", p: 1 }}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </Button>
                  ),
                }}
              />

              <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : "Reset Password"}
              </Button>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2">
                  Remember your password?{" "}
                  <MuiLink component={Link} href="/login" underline="hover">
                    Sign in
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

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
