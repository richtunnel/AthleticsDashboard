"use client";

import React, { useState } from "react";
import { Card, CardContent, Typography, Button, Stack, Alert, CircularProgress, Box, Chip } from "@mui/material";
import { SecurityOutlined, EmailOutlined, CheckCircle } from "@mui/icons-material";

type Props = {
  lastRecovery?: {
    createdAt: Date | string;
    expiresAt: Date | string;
    used: boolean;
  } | null;
};

export default function AccountRecoverySection({ lastRecovery }: Props) {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ severity: "success" | "error" | "info"; message: string } | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(lastRecovery?.createdAt ? new Date(lastRecovery.createdAt) : null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(lastRecovery?.expiresAt ? new Date(lastRecovery.expiresAt) : null);

  const isLinkValid = lastSent && expiresAt && new Date() < expiresAt && !lastRecovery?.used;

  const handleRequestRecovery = async () => {
    setLoading(true);
    setAlert(null);

    try {
      const response = await fetch("/api/account-recovery/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        setAlert({
          severity: "success",
          message: result.message || "Recovery email sent successfully!",
        });
        setLastSent(new Date(result.lastSent));
        setExpiresAt(new Date(result.expiresAt));
      } else {
        setAlert({
          severity: "error",
          message: result.message || "Failed to send recovery email",
        });
      }
    } catch (err) {
      console.error("Recovery request error:", err);
      setAlert({
        severity: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (expiryDate: Date | null) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  };

  return (
    <Card sx={{ maxWidth: "720px" }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SecurityOutlined color="primary" />
            <Typography variant="h6">Account Recovery</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary">
            Generate a secure account recovery link that can be used to restore your account access if it's scheduled for deletion or if you need to
            reactivate your subscription. This link will be sent to your registered email address.
          </Typography>

          {isLinkValid && (
            <Alert
              severity="info"
              icon={<CheckCircle />}
              action={
                <Chip label={getTimeRemaining(expiresAt)} size="small" color="info" />
              }
            >
              <Typography variant="body2">
                <strong>Active recovery link available</strong>
                <br />
                Last sent: {formatDate(lastSent)}
                <br />
                Check your email for the recovery link.
              </Typography>
            </Alert>
          )}

          {alert && (
            <Alert severity={alert.severity} onClose={() => setAlert(null)}>
              {alert.message}
            </Alert>
          )}

          {lastSent && !isLinkValid && (
            <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Last recovery email sent: {formatDate(lastSent)}
              </Typography>
            </Box>
          )}

          <Box>
            <Button
              variant="contained"
              color="primary"
              onClick={handleRequestRecovery}
              disabled={loading || isLinkValid}
              startIcon={loading ? <CircularProgress size={18} /> : <EmailOutlined />}
            >
              {loading ? "Sending..." : isLinkValid ? "Recovery Link Active" : "Send Recovery Email"}
            </Button>
          </Box>

          <Box sx={{ p: 2, bgcolor: "warning.lighter", borderRadius: 1, border: "1px solid", borderColor: "warning.main" }}>
            <Typography variant="caption" color="text.primary">
              <strong>⚠️ Security Notice:</strong> Recovery links are single-use and expire after 24 hours. Each link can only be used once to restore your
              account. You can request a new recovery link once per hour.
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
