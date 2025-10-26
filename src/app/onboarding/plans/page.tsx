"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, Typography, ToggleButton, ToggleButtonGroup, Grid, Stack, Divider, useTheme, Alert } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";
import BaseHeader from "@/components/headers/_base";
import { AuthActionButton } from "@/components/auth/AuthActionButton";

const plans = [
  {
    name: "Free Trial Plan",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "Sync personal calendars & spreadsheets",
      "Automated Bus & Event scheduling",
      "Import/Export and Sync your spreadsheets",
      "Search, find, group and send schedules",
      "Real-time data analytics",
      "200+ batch email campaigns",
      "Advanced reporting and analytics",
      "Up to 6 individual users",
      "Basic chat and email support",
      "2 weeks free trial period",
    ],
  },
  {
    name: "Directors plan",
    monthlyPrice: 40,
    annualPrice: 250,
    mostPopular: true,
    features: ["Everything in Free plan plus...", "50,000+ batch email sends", "Advanced reporting and analytics", "Up to 20 individual users", "Priority chat and email support"],
  },
  // {
  //   name: "Enterprise plan",
  //   monthlyPrice: 64,
  //   annualPrice: 52,
  //   features: ["Everything in Business plus...", "200+ integrations", "Advanced reporting and analytics", "Unlimited individual users", "Unlimited individual data", "Personalized + priority service"],
  // },
];

export default function PricingPlansPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();

  const handleBackClick = () => {
    router.back();
  };

  const handleBillingChange = (_event: React.MouseEvent<HTMLElement>, newBilling: "monthly" | "annual" | null) => {
    if (newBilling) setBilling(newBilling);
  };

  const handleSelectPlan = async (planName: string) => {
    setError(null);
    setLoading(true);

    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      setError((current) => current ?? "Plan selection is taking longer than expected. Please try again.");
    }, 10000);

    try {
      if (planName === "Free Trial Plan") {
        router.push("/onboarding/signup?plan=free_trial_plan");
        return;
      }

      const planType = billing === "monthly" ? "MONTHLY" : "ANNUAL";

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: unknown) {
      console.error("Plan selection error:", err);
      setError(err instanceof Error ? err.message : "Failed to start checkout. Please try again.");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <>
      {/* <BaseHeader /> */}
      <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
        {/* Header */}
        <Typography variant="body1">
          <button style={{ cursor: "pointer" }} type="button" className="button" onClick={handleBackClick}>
            <span>
              <ArrowBackIcon sx={{ fontSize: 15 }} />
            </span>
            &nbsp;Back
          </button>
        </Typography>
        <Typography style={{ marginBottom: "0.25rem" }} variant="h4" fontWeight={400} gutterBottom>
          <span style={{ fontWeight: 700, fontStyle: "normal" }}>Choose the automation you need</span>
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          or get an assist from one of our experts
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 3, mb: 3, maxWidth: 600, mx: "auto" }}>
            {error}
          </Alert>
        )}

        {/* Billing toggle */}
        <ToggleButtonGroup color="primary" value={billing} exclusive onChange={handleBillingChange} sx={{ mt: 4, mb: 6 }} disabled={loading}>
          <ToggleButton style={{ fontSize: "0.75rem" }} value="monthly">
            Monthly billing
          </ToggleButton>
          <ToggleButton style={{ fontSize: "0.75rem" }} value="annual">
            Annual billing
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Pricing cards */}
        <Grid container spacing={4} justifyContent="center" sx={{ maxWidth: 1100, mx: "auto" }}>
          {plans.map((plan) => (
            <Grid size={{ xs: 12, sm: 12, md: 10 }} key={plan.name}>
              <Card
                elevation={plan.mostPopular ? 8 : 2}
                sx={{
                  height: "100%",
                  borderRadius: 4,
                  border: plan.mostPopular && billing === "monthly" ? `2px solid ${theme.palette.primary.main}` : "1px solid #ddd",
                  position: "relative",
                }}
              >
                {plan.mostPopular && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      bgcolor: theme.palette.primary.main,
                      color: "white",
                      fontSize: 12,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 10,
                    }}
                  >
                    Most popular
                  </Box>
                )}
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    {plan.name}
                  </Typography>

                  <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
                    ${billing === "monthly" ? plan.monthlyPrice : plan.annualPrice}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    per month
                  </Typography>

                  <AuthActionButton
                    fullWidth
                    variant={plan.mostPopular ? "contained" : "outlined"}
                    size="large"
                    sx={{ borderRadius: 2, mb: 3 }}
                    onClick={() => handleSelectPlan(plan.name)}
                    loading={loading}
                    disabled={loading}
                    loadingText="Processing..."
                  >
                    Get started
                  </AuthActionButton>

                  <Divider sx={{ mb: 3 }} />

                  <Stack sx={{ textAlign: "left" }} spacing={1} alignItems="flex-start">
                    {plan.features.map((feature) => (
                      <Box key={feature} display="flex" alignItems="center" gap={1}>
                        <CheckIcon fontSize="small" color="action" />
                        <Typography variant="body2">{feature}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </>
  );
}
