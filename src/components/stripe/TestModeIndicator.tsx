"use client";

import { Alert, Box, Chip, Typography } from "@mui/material";
import { Info, Warning } from "@mui/icons-material";

interface TestModeIndicatorProps {
  variant?: "chip" | "banner" | "subtle";
  showWarning?: boolean;
}

/**
 * Visual indicator when Stripe is in test mode
 * Only shows in non-production environments
 */
export function TestModeIndicator({ 
  variant = "banner", 
  showWarning = true 
}: TestModeIndicatorProps) {
  // Only show in development/test environments
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if we're in production - don't show the indicator
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return null;
  }

  if (variant === "chip") {
    return (
      <Chip
        icon={<Info fontSize="small" />}
        label="Test Mode"
        color="warning"
        size="small"
        sx={{ 
          fontWeight: 600,
          fontSize: "0.75rem",
        }}
      />
    );
  }

  if (variant === "subtle") {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          bgcolor: "warning.light",
          color: "warning.dark",
          borderRadius: 1,
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        <Info sx={{ fontSize: 14 }} />
        <Typography variant="caption" fontWeight={600}>
          Test Mode
        </Typography>
      </Box>
    );
  }

  // Banner variant (default)
  return (
    <Alert 
      severity={showWarning ? "warning" : "info"}
      icon={showWarning ? <Warning /> : <Info />}
      sx={{ 
        mb: 2,
        "& .MuiAlert-message": {
          width: "100%",
        }
      }}
    >
      <Typography variant="body2" fontWeight={600} gutterBottom>
        Stripe Test Mode Active
      </Typography>
      <Typography variant="caption">
        You&apos;re using test mode. Use test card <code>4242 4242 4242 4242</code> for checkout.
        Real charges will not be made.
      </Typography>
    </Alert>
  );
}

/**
 * Test card reference component
 */
export function TestCardReference() {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        bgcolor: "grey.50",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "grey.200",
      }}
    >
      <Typography variant="subtitle2" gutterBottom fontWeight={600}>
        Test Cards:
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.875rem" }}>
        <li>
          <strong>Success:</strong> <code>4242 4242 4242 4242</code>
        </li>
        <li>
          <strong>Decline:</strong> <code>4000 0000 0000 0002</code>
        </li>
        <li>
          <strong>3D Secure:</strong> <code>4000 0025 0000 3155</code>
        </li>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        Use any future expiry date and any CVC
      </Typography>
    </Box>
  );
}
