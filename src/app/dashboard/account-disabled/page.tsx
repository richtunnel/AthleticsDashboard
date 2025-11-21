"use client";

import { Box, Container, Typography, Paper, Button, Alert } from "@mui/material";
import { BlockOutlined as BlockIcon, Email as EmailIcon } from "@mui/icons-material";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function AccountDisabledPage() {
  const { data: session } = useSession();
  const [disableReason, setDisableReason] = useState<string | null>(null);

  useEffect(() => {
    // Fetch disable reason from API
    async function fetchDisableStatus() {
      try {
        const response = await fetch("/api/user/payment-status");
        if (response.ok) {
          const data = await response.json();
          setDisableReason(data.disableReason);
        }
      } catch (error) {
        console.error("Error fetching disable status:", error);
      }
    }

    fetchDisableStatus();
  }, []);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const getReasonMessage = () => {
    if (disableReason === "PAYMENT_OVERDUE") {
      return "Your account has been disabled due to payment being overdue for more than 48 hours.";
    } else if (disableReason === "MANUAL" || disableReason === "ADMIN_ACTION") {
      return "Your account has been disabled by an administrator.";
    } else if (disableReason === "VIOLATION") {
      return "Your account has been disabled due to a violation of our terms of service.";
    }
    return "Your account has been disabled.";
  };

  const getActionMessage = () => {
    if (disableReason === "PAYMENT_OVERDUE") {
      return "To restore access to your account, please contact our support team to resolve the payment issue.";
    }
    return "Please contact our support team for more information about your account status.";
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <BlockIcon
            sx={{
              fontSize: 80,
              color: "error.main",
              mb: 3,
            }}
          />

          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Account Disabled
          </Typography>

          <Alert severity="error" sx={{ width: "100%", mb: 3 }}>
            {getReasonMessage()}
          </Alert>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {getActionMessage()}
          </Typography>

          {session?.user?.email && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Account: <strong>{session.user.email}</strong>
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EmailIcon />}
              href="mailto:support@yourdomain.com"
              sx={{ minWidth: 200 }}
            >
              Contact Support
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              onClick={handleSignOut}
              sx={{ minWidth: 200 }}
            >
              Sign Out
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 4 }}>
            If you believe this is an error, please contact us immediately.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
