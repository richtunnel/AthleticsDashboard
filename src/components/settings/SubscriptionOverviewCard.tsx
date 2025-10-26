"use client";

import { useState } from "react";
import { Card, CardContent, Typography, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert, CircularProgress, Divider, Stack } from "@mui/material";
import { CreditCard as CreditCardIcon, Cancel as CancelIcon, PlayArrow as PlayArrowIcon, Email as EmailIcon, History as HistoryIcon } from "@mui/icons-material";
import type { PlanType, SubscriptionStatus, UserRole } from "@prisma/client";

interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  planType: PlanType | null;
  billingCycle: string | null;
  priceId: string | null;
  planProductId: string | null;
  planLookupKey: string | null;
  planNickname: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  deletionScheduledAt: Date | null;
  gracePeriodEndsAt: Date | null;
  stripeSubscriptionId: string | null;
}

interface RecoveryEmailData {
  id: string;
  email: string;
  verified: boolean;
}

interface LastLoginData {
  timestamp: Date;
  city: string | null;
  country: string | null;
}

interface SubscriptionOverviewCardProps {
  subscription: SubscriptionData | null;
  recoveryEmail: RecoveryEmailData | null;
  lastLogin: LastLoginData | null;
  todayLoginCount: number;
  stripeCustomerId: string | null;
  userRole: UserRole | null;
  userPlan: string | null;
}

export default function SubscriptionOverviewCard({ subscription, recoveryEmail, lastLogin, todayLoginCount, stripeCustomerId, userRole, userPlan }: SubscriptionOverviewCardProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recoveryEmailDialogOpen, setRecoveryEmailDialogOpen] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState("");
  const [optimisticState, setOptimisticState] = useState(subscription);

  const displaySubscription = optimisticState || subscription;
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isFreePlan = !displaySubscription && !isSuperAdmin;

  const planLabel = displaySubscription ? getPlanDisplayName(displaySubscription) : isSuperAdmin ? "Admin Account" : userPlan ? formatPlanType(userPlan) : "Free Plan";
  const billingLabelRaw = displaySubscription?.billingCycle ? formatPlanType(displaySubscription.billingCycle) : null;
  const showBillingLabel = !!displaySubscription && !!billingLabelRaw && billingLabelRaw !== planLabel;

  const handleOpenPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open portal");
      }

      // Open portal in new tab
      window.open(data.url, "_blank");
    } catch (err: any) {
      setError(err.message || "Failed to open customer portal");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Optimistically update the UI
      if (displaySubscription) {
        setOptimisticState({
          ...displaySubscription,
          status: "CANCELED",
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
          gracePeriodEndsAt: data.gracePeriodEndsAt ? new Date(data.gracePeriodEndsAt) : null,
          deletionScheduledAt: data.gracePeriodEndsAt ? new Date(data.gracePeriodEndsAt) : null,
        });
      }

      setSuccess("Subscription cancelled successfully. You can still access your account until the end of the billing period.");
      setCancelDialogOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to cancel subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/subscription/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resume subscription");
      }

      // Optimistically update the UI
      if (displaySubscription) {
        setOptimisticState({
          ...displaySubscription,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          canceledAt: null,
          gracePeriodEndsAt: null,
          deletionScheduledAt: null,
        });
      }

      setSuccess("Subscription resumed successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to resume subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (!recoveryEmailInput || !recoveryEmailInput.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recovery-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryEmail: recoveryEmailInput }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send recovery email");
      }

      setSuccess("Verification email sent! Please check your inbox.");
      setRecoveryEmailDialogOpen(false);
      setRecoveryEmailInput("");
    } catch (err: any) {
      setError(err.message || "Failed to send recovery email");
    } finally {
      setLoading(false);
    }
  };

  function getStatusColor(status: SubscriptionStatus | string): "success" | "warning" | "error" | "info" {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "TRIALING":
        return "info";
      case "CANCELED":
      case "GRACE_PERIOD":
        return "warning";
      case "PAST_DUE":
      case "UNPAID":
        return "error";
      default:
        return "info";
    }
  }

  function formatPlanType(planType: PlanType | string | null): string {
    if (!planType) {
      return "Unknown";
    }

    return planType
      .toString()
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  function getPlanDisplayName(sub: SubscriptionData): string {
    if (sub.planNickname) {
      return sub.planNickname;
    }
    if (sub.planLookupKey) {
      return formatPlanType(sub.planLookupKey);
    }
    if (sub.planType) {
      return formatPlanType(sub.planType);
    }
    if (sub.planProductId) {
      return sub.planProductId;
    }
    if (sub.priceId) {
      return sub.priceId;
    }
    return "Unknown";
  }

  const formatDate = (date: Date | null): string => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getDaysUntil = (date: Date | null): number | null => {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <Box sx={{ px: 3, pb: 3, pt: 0 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CreditCardIcon />
              Billing & Subscription
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {/* Subscription Details */}
            <Box sx={{ mb: 3 }}>
              {isSuperAdmin && (
                <Stack spacing={2} sx={{ mb: displaySubscription ? 3 : 0 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body1" fontWeight="medium">
                      Plan: Admin Account
                    </Typography>
                    <Chip label="SUPER ADMIN" color="info" size="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    You have full access to all features as a super administrator. No active subscription is required.
                  </Typography>
                  {!displaySubscription && (
                    <Typography variant="body2" color="text.secondary">
                      Billing for super admin accounts is managed outside of this workspace.
                    </Typography>
                  )}
                </Stack>
              )}

              {displaySubscription && (
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body1" fontWeight="medium">
                      Plan: {planLabel === "Unknown" ? "Unknown Plan" : planLabel}
                      {showBillingLabel && ` (${billingLabelRaw})`}
                    </Typography>
                    <Chip label={displaySubscription.status} color={getStatusColor(displaySubscription.status)} size="small" />
                  </Box>

                  {displaySubscription.currentPeriodStart && (
                    <Typography variant="body2" color="text.secondary">
                      Billing period: {formatDate(displaySubscription.currentPeriodStart)} - {formatDate(displaySubscription.currentPeriodEnd)}
                    </Typography>
                  )}

                  {displaySubscription.currentPeriodEnd && !displaySubscription.cancelAtPeriodEnd && (
                    <Typography variant="body2" color="text.secondary">
                      Next payment: {formatDate(displaySubscription.currentPeriodEnd)}
                    </Typography>
                  )}

                  {displaySubscription.cancelAtPeriodEnd && displaySubscription.currentPeriodEnd && (
                    <Alert severity="warning">Your subscription is cancelled and will end on {formatDate(displaySubscription.currentPeriodEnd)}</Alert>
                  )}

                  {displaySubscription.deletionScheduledAt && (
                    <Alert severity="error">
                      Account deletion scheduled for {formatDate(displaySubscription.deletionScheduledAt)}
                      {getDaysUntil(displaySubscription.deletionScheduledAt) !== null && <> ({getDaysUntil(displaySubscription.deletionScheduledAt)} days remaining)</>}
                    </Alert>
                  )}

                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <CreditCardIcon />} onClick={handleOpenPortal} disabled={loading}>
                      Manage Billing
                    </Button>

                    {displaySubscription.status === "ACTIVE" && !displaySubscription.cancelAtPeriodEnd && (
                      <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setCancelDialogOpen(true)} disabled={loading}>
                        Cancel Subscription
                      </Button>
                    )}

                    {displaySubscription.cancelAtPeriodEnd && displaySubscription.gracePeriodEndsAt && getDaysUntil(displaySubscription.gracePeriodEndsAt)! > 0 && (
                      <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} onClick={handleResumeSubscription} disabled={loading}>
                        Resume Subscription
                      </Button>
                    )}
                  </Box>
                </Stack>
              )}

              {isFreePlan && (
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body1" fontWeight="medium">
                      Plan: {planLabel}
                    </Typography>
                    <Chip label="FREE" color="default" size="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    You are currently on the free plan. Upgrade to unlock more features.
                  </Typography>
                  <Box>
                    <Button variant="contained" color="primary" href="/onboarding/plans">
                      View Plans
                    </Button>
                  </Box>
                </Stack>
              )}
            </Box>

            <Divider sx={{ my: 3, borderColor: "lightgray" }} />

            {/* Account Recovery */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Account Recovery
              </Typography>
              {recoveryEmail ? (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Recovery email: {recoveryEmail.email}
                    {recoveryEmail.verified && <Chip label="Verified" color="success" size="small" sx={{ ml: 1 }} />}
                    {!recoveryEmail.verified && <Chip label="Not Verified" color="warning" size="small" sx={{ ml: 1 }} />}
                  </Typography>
                  <Button variant="text" size="small" onClick={() => setRecoveryEmailDialogOpen(true)} sx={{ mt: 1 }}>
                    Update Recovery Email
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    No recovery email set
                  </Typography>
                  <Button variant="outlined" size="small" startIcon={<EmailIcon />} onClick={() => setRecoveryEmailDialogOpen(true)}>
                    Add Recovery Email
                  </Button>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 3, borderColor: "lightgray" }} />

            {/* Login Activity */}
            <Box>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <HistoryIcon fontSize="small" />
                Login Activity
              </Typography>
              <Stack spacing={1}>
                {lastLogin ? (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Last login:{" "}
                      {new Date(lastLogin.timestamp).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                    {lastLogin.city && (
                      <Typography variant="body2" color="text.secondary">
                        Location: {lastLogin.city}
                        {lastLogin.country && `, ${lastLogin.country}`}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Today's logins: {todayLoginCount}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No login activity recorded
                  </Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => !loading && setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Subscription?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel your subscription? You'll still have access to your account until the end of your current billing period, and you can resume your subscription within the
            grace period.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={loading}>
            Keep Subscription
          </Button>
          <Button onClick={handleCancelSubscription} color="error" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : null}>
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recovery Email Dialog */}
      <Dialog open={recoveryEmailDialogOpen} onClose={() => !loading && setRecoveryEmailDialogOpen(false)}>
        <DialogTitle>{recoveryEmail ? "Update" : "Add"} Recovery Email</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>Enter an email address that can be used to recover your account if you lose access.</DialogContentText>
          <input
            type="email"
            value={recoveryEmailInput}
            onChange={(e) => setRecoveryEmailInput(e.target.value)}
            placeholder="recovery@example.com"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecoveryEmailDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSendRecoveryEmail} color="primary" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <EmailIcon />}>
            Send Verification
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
