"use client";

import { Suspense, useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, ToggleButton, ToggleButtonGroup, Grid, Stack, Divider, useTheme, Alert, CircularProgress } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import BaseHeader from "@/components/headers/_base";

const DIRECTORS_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "";
const DIRECTORS_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? "";

type BillingInterval = "monthly" | "annual";

type Plan = {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  mostPopular?: boolean;
  monthlyPriceId?: string;
  annualPriceId?: string;
  isFree?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free Trial Plan",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "Sync personal calendars & spreadsheets",
      "Automated Bus & Event scheduling",
      "Import/Export and Sync your spreadsheets",
      "Search, find, group and send schedules",
      "200+ batch email campaigns",
      "Real-time reporting and analytics",
      "Basic chat and email support",
      "2 weeks free trial",
    ],
    isFree: true,
  },
  {
    name: "Directors plan",
    monthlyPrice: 40,
    annualPrice: 250,
    mostPopular: true,
    features: ["Everything in Free plan plus...", "50,000+ batch email sends", "Up to 10 individual users", "Priority chat and email support"],
    monthlyPriceId: DIRECTORS_MONTHLY_PRICE_ID,
    annualPriceId: DIRECTORS_ANNUAL_PRICE_ID,
  },
];

function PlansLoadingFallback() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "400px",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function PricingPlansContent() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [hasDismissedCheckoutAlert, setHasDismissedCheckoutAlert] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const isBusy = loadingKey !== null;
  const checkoutStatus = searchParams.get("checkout");
  const showCancelledAlert = !hasDismissedCheckoutAlert && checkoutStatus === "cancelled";
  const hasActiveSubscription = subscriptionStatus === "ACTIVE" || subscriptionStatus === "TRIALING";

  useEffect(() => {
    let isMounted = true;

    if (sessionStatus !== "authenticated") {
      if (isMounted) {
        setSubscriptionStatus(null);
      }
      return () => {
        isMounted = false;
      };
    }

    (async () => {
      try {
        const response = await fetch("/api/subscription/status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to fetch subscription status");
        }

        if (isMounted) {
          setSubscriptionStatus(data?.subscription?.status ?? null);
        }
      } catch (err) {
        console.error("Error fetching subscription status:", err);
        if (isMounted) {
          setError((current) => current ?? "Unable to determine your subscription status. Please try again later.");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [sessionStatus]);

  const handleBackClick = () => {
    router.back();
  };

  const handleBillingChange = (_event: React.MouseEvent<HTMLElement>, newBilling: BillingInterval | null) => {
    if (newBilling) setBilling(newBilling);
  };

  const handleSelectPlan = async (plan: Plan, planKey: string) => {
    setError(null);

    if (plan.isFree) {
      router.push("/onboarding/signup?plan=free_trial_plan");
      return;
    }

    if (hasActiveSubscription) {
      router.push("/dashboard/settings");
      return;
    }

    if (sessionStatus === "loading") {
      setError("Please wait while we confirm your account. Try again in a moment.");
      return;
    }

    if (sessionStatus !== "authenticated" || !session?.user) {
      const callbackUrl = encodeURIComponent("/onboarding/plans");
      router.push(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    const priceId = billing === "monthly" ? plan.monthlyPriceId : plan.annualPriceId;

    if (!priceId) {
      setError("This plan is not currently available. Please contact support.");
      return;
    }

    setLoadingKey(planKey);

    const timeoutId = window.setTimeout(() => {
      setLoadingKey(null);
      setError((current) => current ?? "Plan selection is taking longer than expected. Please try again.");
    }, 10000);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create checkout session");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      throw new Error("No checkout URL returned");
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      setError(err instanceof Error ? err.message : "Failed to start checkout. Please try again.");
    } finally {
      clearTimeout(timeoutId);
      setLoadingKey(null);
    }
  };

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
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

        {showCancelledAlert && (
          <Alert
            severity="warning"
            sx={{ mt: 3, mb: 3, maxWidth: 600, mx: "auto" }}
            onClose={() => {
              setHasDismissedCheckoutAlert(true);
              router.replace("/onboarding/plans");
            }}
          >
            Your payment was cancelled. You can try again whenever you&apos;re ready.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3, mb: 3, maxWidth: 600, mx: "auto" }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <ToggleButtonGroup color="primary" value={billing} exclusive onChange={handleBillingChange} sx={{ mt: 4, mb: 6 }} disabled={isBusy}>
          <ToggleButton style={{ fontSize: "0.75rem" }} value="monthly">
            Monthly billing
          </ToggleButton>
          <ToggleButton style={{ fontSize: "0.75rem" }} value="annual">
            Annual billing
          </ToggleButton>
        </ToggleButtonGroup>

        <Grid container spacing={4} justifyContent="center" sx={{ maxWidth: 1100, mx: "auto" }}>
          {plans.map((plan) => {
            const planKey = plan.isFree ? `${plan.name}-free` : `${plan.name}-${billing}`;
            const selectedPriceId = billing === "monthly" ? plan.monthlyPriceId : plan.annualPriceId;
            const requiresPriceId = !plan.isFree;
            const disableForMissingPrice = requiresPriceId && !selectedPriceId && !(hasActiveSubscription && !plan.isFree);
            const buttonDisabled = Boolean(loadingKey) || disableForMissingPrice;
            const isLoading = loadingKey === planKey;
            const buttonLabel = hasActiveSubscription && !plan.isFree ? "Manage Subscription" : "Get started";

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan.name}>
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
                      {billing !== "monthly" ? "per year" : "per month"}
                    </Typography>

                    <AuthActionButton
                      fullWidth
                      variant={plan.mostPopular ? "contained" : "outlined"}
                      size="large"
                      sx={{ borderRadius: 2, mb: 3 }}
                      onClick={() => handleSelectPlan(plan, planKey)}
                      loading={isLoading}
                      disabled={buttonDisabled}
                    >
                      {buttonLabel}
                    </AuthActionButton>

                    {!plan.isFree && !selectedPriceId && !hasActiveSubscription && (
                      <Typography variant="caption" color="error" display="block" sx={{ mb: 2 }}>
                        This plan is currently unavailable. <br />
                        Please contact support.
                      </Typography>
                    )}

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
            );
          })}
        </Grid>
      </Box>
    </>
  );
}

export default function PricingPlansPage() {
  return (
    <Suspense fallback={<PlansLoadingFallback />}>
      <PricingPlansContent />
    </Suspense>
  );
}
