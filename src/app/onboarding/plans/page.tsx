"use client";

import { Suspense, useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, ToggleButton, ToggleButtonGroup, Grid, Stack, Divider, useTheme, Alert, CircularProgress } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SettingsIcon from "@mui/icons-material/Settings";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import BaseHeader from "@/components/headers/_base";
import { TestModeIndicator } from "@/components/stripe/TestModeIndicator";
import Footer from "@/components/layout/Footer";
import BookDemoButton from "@/components/buttons/BookDemoButton";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

const DIRECTORS_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "";
const DIRECTORS_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? "";

function isValidPriceId(priceId: string): boolean {
  if (!priceId) return false;
  if (priceId.includes("your_monthly_price_id")) return false;
  if (priceId.includes("your_annual_price_id")) return false;
  if (!priceId.startsWith("price_")) return false;
  return priceId.length > 10;
}

function isPriceConfigured(): boolean {
  return isValidPriceId(DIRECTORS_MONTHLY_PRICE_ID) && isValidPriceId(DIRECTORS_ANNUAL_PRICE_ID);
}

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
    name: "Free Trial (Standard)",
    monthlyPrice: 19,
    annualPrice: 125,
    features: [
      "Email game schedules using campaign manager",
      "200+ batch email campaigns",
      "Travel Recommendations (Bus Departure)",
      "Table customization (filters, ordering)",
      "Basic chat and email support",
      "1 user",
      "2 weeks free trial",
    ],
    isFree: true,
  },
  {
    name: "Team",
    monthlyPrice: 37,
    annualPrice: 250,
    mostPopular: true,
    features: [
      "Sync schedule with your google calendars +groups",
      "150,000 emails/mo. (Parents, Schools, etc.)",
      "Use AI to scan for dates",
      "Custom Email Signatures",
      "4 Users",
      "Premium chat and email support 24hrs.",
      "Everything in Standard plan.",
    ],
    isFree: true,
  },
  {
    name: "Team+ (Plus)",
    monthlyPrice: 60,
    annualPrice: 350,
    features: [
      "Everything in Team plan plus...",
      "250,000+ email/mo.",
      "6 Users",
      "AI Email Generation",
      "Email time scheduler +verification",
      "Schedule Conflict Detection",
      "Score Tracker",
      "Budget Planner",
      "School Theme Customization",
      "Priority chat and email support (Now)",
    ],
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
  const priceConfigured = isPriceConfigured();
  const isDevelopment = process.env.NODE_ENV !== "production";

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

    // Track Get Started button click
    trackEvent("Get Started Clicked", {
      source: "onboarding_plans",
      plan_name: plan.name,
      plan_type: plan.isFree ? "free_trial" : "paid",
      billing_interval: plan.isFree ? "trial" : billing,
      price: billing === "monthly" ? plan.monthlyPrice : plan.annualPrice,
    });

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

    if (!priceId || !isValidPriceId(priceId)) {
      if (isDevelopment) {
        setError(`Stripe price ID not configured. Please set NEXT_PUBLIC_STRIPE_${billing === "monthly" ? "MONTHLY" : "ANNUAL"}_PRICE_ID in your .env.local file.`);
      } else {
        setError("This plan is not currently available. Please contact support.");
      }
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ py: 4, px: 2, textAlign: "center", flex: 1 }}>
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

        <Box sx={{ mt: 2, mb: 3 }}>
          <BookDemoButton calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/opletics/30min"} />
        </Box>

        <Box sx={{ maxWidth: 800, mx: "auto", mt: 3 }}>
          <TestModeIndicator variant="banner" />
        </Box>

        {!priceConfigured && isDevelopment && (
          <Alert severity="error" icon={<SettingsIcon />} sx={{ mt: 3, mb: 3, maxWidth: 800, mx: "auto" }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Stripe Price IDs Not Configured
            </Typography>
            <Typography variant="caption" component="div" sx={{ mb: 1 }}>
              To enable subscription checkout, you need to configure Stripe price IDs in your environment variables:
            </Typography>
            <Box
              component="ul"
              sx={{
                fontSize: "0.75rem",
                pl: 2,
                my: 1,
                "& code": {
                  bgcolor: "rgba(0,0,0,0.1)",
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  fontFamily: "monospace",
                },
              }}
            >
              <li>
                Set <code>NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID</code> in your <code>.env.local</code> file
              </li>
              <li>
                Set <code>NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID</code> in your <code>.env.local</code> file
              </li>
            </Box>
            <Typography variant="caption" color="text.secondary">
              See <code>docs/STRIPE_QUICK_START.md</code> for setup instructions.
            </Typography>
          </Alert>
        )}

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
                    borderRadius: 2,
                    border: plan.mostPopular && billing === "monthly" ? `2px solid ${theme.palette.primary.main}` : "1px solid #ddd",
                    position: "relative",
                    minHeight: "650px",
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
                        {isDevelopment ? (
                          <>
                            Price ID not configured.
                            <br />
                            See banner above for setup instructions.
                          </>
                        ) : (
                          <>
                            This plan is currently unavailable.
                            <br />
                            Please contact support.
                          </>
                        )}
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
      <Footer />
    </Box>
  );
}

export default function PricingPlansPage() {
  return (
    <Suspense fallback={<PlansLoadingFallback />}>
      <PricingPlansContent />
    </Suspense>
  );
}
