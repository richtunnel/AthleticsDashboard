"use client";

import React, { useState } from "react";
import { Card, CardContent, Typography, TextField, Button, Stack, Alert, Box, LinearProgress } from "@mui/material";
import { changePassword } from "@/app/dashboard/settings/actions";

type Props = {
  hasPassword: boolean;
  hasGoogleAccount: boolean;
};

function getPasswordStrength(password: string): { score: number; label: string; color: "error" | "warning" | "success" } {
  if (password.length === 0) return { score: 0, label: "", color: "error" };
  if (password.length < 8) return { score: 25, label: "Too short", color: "error" };

  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 50) return { score, label: "Weak", color: "error" };
  if (score < 75) return { score, label: "Fair", color: "warning" };
  return { score, label: "Strong", color: "success" };
}

export default function PasswordChangeForm({ hasPassword, hasGoogleAccount }: Props) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ severity: "success" | "error"; message: string } | null>(null);

  const passwordStrength = getPasswordStrength(form.newPassword);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
    setAlert(null);
  };

  const validate = () => {
    if (hasPassword && !form.currentPassword) {
      return "Current password is required";
    }
    if (!form.newPassword) {
      return "New password is required";
    }
    if (form.newPassword.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (form.newPassword === form.currentPassword) {
      return "New password must be different from current password";
    }
    if (form.newPassword !== form.confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      setAlert({ severity: "error", message: err });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const res = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      if (res?.success) {
        setAlert({ severity: "success", message: "Password updated successfully." });
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setAlert({ severity: "error", message: res?.error || "Failed to update password." });
      }
    } catch (err: any) {
      console.error("Password change error:", err);
      setAlert({ severity: "error", message: err?.message || "Unexpected error" });
    } finally {
      setLoading(false);
    }
  };

  if (hasGoogleAccount && !hasPassword) {
    return (
      <Card sx={{ border: "none", boxShadow: "none", maxWidth: "720px" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Password
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Your account was created with Google. You don't need a password to sign in.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ border: "none", boxShadow: "none", maxWidth: "720px" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Change Password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Update your password to keep your account secure.
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {hasPassword && (
              <TextField
                size="small"
                label="Current Password"
                name="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={handleChange}
                required
                fullWidth
              />
            )}

            <TextField
              size="small"
              label="New Password"
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={handleChange}
              required
              fullWidth
              helperText="Minimum 8 characters"
            />

            {form.newPassword && (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Password strength:
                  </Typography>
                  <Typography variant="caption" color={`${passwordStrength.color}.main`} fontWeight="medium">
                    {passwordStrength.label}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={passwordStrength.score} color={passwordStrength.color} sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            )}

            <TextField
              size="small"
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              fullWidth
            />

            {alert && <Alert severity={alert.severity}>{alert.message}</Alert>}

            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
