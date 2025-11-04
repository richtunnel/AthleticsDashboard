"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Link,
} from "@mui/material";
import { Receipt as ReceiptIcon, OpenInNew as OpenInNewIcon } from "@mui/icons-material";

interface Payment {
  id: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  planName: string | null;
  billingCycle: string | null;
  paidAt: string | null;
  createdAt: string;
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/payments/history");

      if (!response.ok) {
        throw new Error("Failed to fetch payment history");
      }

      const data = await response.json();
      setPayments(data.payments || []);
    } catch (err: any) {
      setError(err.message || "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (date: string | null): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status.toLowerCase()) {
      case "paid":
        return "success";
      case "failed":
        return "error";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const formatPlanName = (planName: string | null, billingCycle: string | null): string => {
    if (!planName) return "N/A";
    
    const formatted = planName
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    
    if (billingCycle && !formatted.toLowerCase().includes(billingCycle.toLowerCase())) {
      return `${formatted} (${billingCycle})`;
    }
    
    return formatted;
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (payments.length === 0) {
    return (
      <Card sx={{ boxShadow: "none!important" }}>
        <CardContent>
          <Box sx={{ textAlign: "center", py: 4 }}>
            <ReceiptIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No payment history
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your payment history will appear here once you make your first payment.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ boxShadow: "none!important" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <ReceiptIcon />
          Payment History
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatPlanName(payment.planName, payment.billingCycle)}
                    </Typography>
                    {payment.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {payment.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatAmount(payment.amount, payment.currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={payment.status.toUpperCase()}
                      color={getStatusColor(payment.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                      {payment.invoiceUrl && (
                        <IconButton
                          size="small"
                          component={Link}
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Invoice"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      )}
                      {payment.receiptUrl && (
                        <IconButton
                          size="small"
                          component={Link}
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Receipt"
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
