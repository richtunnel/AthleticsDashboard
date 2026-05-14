"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Link,
} from "@mui/material";
import BaseHeader from "@/components/headers/_base";
import Footer from "@/components/layout/Footer";

export default function RefundPolicyPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, reason }),
      });

      if (res.ok) {
        setResult({ type: "success", text: "Refund request sent successfully! Our team will respond within 1–2 business days." });
        setName("");
        setEmail("");
        setReason("");
        setOpen(false);
      } else {
        const data = await res.json();
        setResult({ type: "error", text: data.error || "Failed to send request. Please email support@opletics.com directly." });
      }
    } catch {
      setResult({ type: "error", text: "Failed to send request. Please email support@opletics.com directly." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Refund Policy
        </Typography>

        <Typography variant="body1" paragraph>
          We have a <strong>72-hour refund policy</strong>, which means you have 3 days after your purchase to request a refund.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          Eligibility
        </Typography>
        <Typography variant="body1" paragraph>
          To be eligible for a refund, your request must be submitted within 72 hours of your original purchase date. Refund requests submitted after this window will not be accepted.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          How to Request a Refund
        </Typography>
        <Typography variant="body1" paragraph>
          To start a refund, you can contact us at{" "}
          <Link href="mailto:support@opletics.com" underline="hover">
            support@opletics.com
          </Link>{" "}
          or use the form below. Please include your account email and a brief reason for the refund request.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          Refund Processing
        </Typography>
        <Typography variant="body1" paragraph>
          We will notify you once we have received and reviewed your request, and let you know if the refund was approved or not. If approved, you will be automatically refunded to your original payment method within <strong>10 business days</strong>. Please remember it can take some time for your bank or credit card company to process and post the refund.
        </Typography>
        <Typography variant="body1" paragraph>
          If more than 15 business days have passed since we approved your refund, please contact us at{" "}
          <Link href="mailto:support@opletics.com" underline="hover">
            support@opletics.com
          </Link>.
        </Typography>

        <Typography variant="h6" fontWeight={600} gutterBottom>
          Exceptions
        </Typography>
        <Typography variant="body1" paragraph>
          Refunds are not available for accounts that have been suspended or terminated due to violations of our Terms of Service. Partial refunds may be issued at our discretion for extenuating circumstances.
        </Typography>

        <Typography variant="body1" paragraph>
          You can always contact us for any refund questions at{" "}
          <Link href="mailto:support@opletics.com" underline="hover">
            support@opletics.com
          </Link>.
        </Typography>

        <Divider sx={{ my: 4 }} />

        {result && (
          <Alert severity={result.type} onClose={() => setResult(null)} sx={{ mb: 3 }}>
            {result.text}
          </Alert>
        )}

        {!open ? (
          <Button
            variant="contained"
            size="large"
            onClick={() => setOpen(true)}
            sx={{ bgcolor: "#ceff77", color: "#000", "&:hover": { bgcolor: "#b8e65f" }, fontWeight: 700 }}
          >
            Request a Refund
          </Button>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 520 }}>
            <Typography variant="h6" fontWeight={600}>
              Refund Request Form
            </Typography>
            <TextField
              label="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="Reason for Refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              fullWidth
              multiline
              rows={4}
              size="small"
              placeholder="Please describe why you are requesting a refund..."
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ bgcolor: "#ceff77", color: "#000", "&:hover": { bgcolor: "#b8e65f" }, fontWeight: 700 }}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {loading ? "Sending..." : "Submit Request"}
              </Button>
              <Button variant="outlined" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Box>
      <Footer />
    </>
  );
}
