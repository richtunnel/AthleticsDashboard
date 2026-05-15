"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertTitle, Box, Button, CircularProgress } from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";

interface PaymentStatus {
  isOverdue: boolean;
  hoursOverdue?: number;
  dueDate?: string;
  status?: string;
  shouldLockDashboard: boolean;
}

export function PaymentOverdueWarning() {
  const searchParams = useSearchParams();
  const isPaymentOverdue = searchParams.get('payment_overdue') === 'true';
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch('/api/user/payment-status');
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, []);

  if (loading) {
    return null; // Don't show loading spinner, just wait
  }

  if (!paymentStatus?.shouldLockDashboard && !isPaymentOverdue) {
    return null;
  }

  const hoursOverdue = paymentStatus?.hoursOverdue || 0;
  const daysOverdue = Math.floor(hoursOverdue / 24);

  const getOverdueMessage = () => {
    if (daysOverdue > 0) {
      return `Your payment is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.`;
    }
    if (hoursOverdue > 0) {
      return `Your payment is ${hoursOverdue} hour${hoursOverdue !== 1 ? 's' : ''} overdue.`;
    }
    return `Your payment is overdue.`;
  };

  return (
    <Alert
      severity="error"
      icon={<WarningIcon />}
      sx={{
        mb: 3,
        '& .MuiAlert-message': {
          width: '100%',
        },
      }}
    >
      <AlertTitle sx={{ fontWeight: 'bold' }}>Payment Overdue - Dashboard Access Limited</AlertTitle>
      <Box>
        {getOverdueMessage()} To restore full access to your dashboard, please update your payment method below.
      </Box>
      <Box sx={{ mt: 2 }}>
        <strong>Important:</strong> While your payment is overdue, access to all dashboard sections except Settings is temporarily restricted.
        Once payment is processed, full access will be restored immediately.
      </Box>
    </Alert>
  );
}
