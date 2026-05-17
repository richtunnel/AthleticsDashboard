"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
import TopFooter from "@/components/footer/topFooter";
import styles from "@/styles/onboarding.module.css";

type StripePriceIds = {
  standardMonthly: string;
  standardAnnual: string;
  teamMonthly: string;
  teamAnnual: string;
  plusMonthly: string;
  plusAnnual: string;
};

const getStripePriceIds = (): StripePriceIds => ({
  standardMonthly: process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO ?? "",
  standardAnnual: process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR ?? "",
  teamMonthly: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO ?? "",
  teamAnnual: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR ?? "",
  plusMonthly: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO ?? "",
  plusAnnual: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR ?? "",
});

function isValidPriceId(priceId: string): boolean {
  if (!priceId) return false;
  if (priceId.includes("your_monthly_price_id")) return false;
  if (priceId.includes("your_annual_price_id")) return false;
  if (!priceId.startsWith("price_")) return false;
  return priceId.length > 10;
}

function isPriceConfigured(priceIds: StripePriceIds): boolean {
  return isValidPriceId(priceIds.standardMonthly) || isValidPriceId(priceIds.teamMonthly) || isValidPriceId(priceIds.plusMonthly);
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

const buildPlans = (priceIds: StripePriceIds): Plan[] => [
  {
    name: "Free Trial (Standard)",
    monthlyPrice: 19,
    annualPrice: 125,
    features: [
      "Sync schedule with your google calendars",
      "Multiple Isolated spreadsheets",
      "Mass email game schedules",
      "Travel Recommendations (Bus Departure)",
      "Table customization (filters, ordering)",
      "1 Collaborator Account",
      "Public posts",
      "Basic chat and email support",
      "2 weeks Free Trial",
    ],
    monthlyPriceId: priceIds.standardMonthly,
    annualPriceId: priceIds.standardAnnual,
  },
  {
    name: "Team",
    monthlyPrice: 37,
    annualPrice: 250,
    mostPopular: true,
    features: [
      "Multiple Isolated spreadsheets",
      "150,000 emails/mo. (Parents, Schools, etc.)",
      "AI scan for available game dates",
      "Parent communication system",
      "Score Tracker",
      "Premium chat and email support 24hrs.",
      "Everything in Standard plan.",
      "2 weeks Free Trial",
    ],
    monthlyPriceId: priceIds.teamMonthly,
    annualPriceId: priceIds.teamAnnual,
  },
  {
    name: "Team+ (Plus)",
    monthlyPrice: 60,
    annualPrice: 350,
    features: [
      "Unlimited isolated spreadsheets",
      "5 collaborators",
      "Everything in Team plan plus...",
      "250,000+ email/mo.",
      "Schedule Conflict Detection",
      "Budget Planner",
      "Priority chat and email support (Now)",
      "2 weeks Free Trial",
    ],
    monthlyPriceId: priceIds.plusMonthly,
    annualPriceId: priceIds.plusAnnual,
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
  const [priceIds, setPriceIds] = useState<StripePriceIds>(() => getStripePriceIds());
  const [hasCheckedPriceConfig, setHasCheckedPriceConfig] = useState(false);
  const [loadingPriceIds, setLoadingPriceIds] = useState(true);
  const router = useRouter();
  const theme = useTheme();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const isBusy = loadingKey !== null || loadingPriceIds;
  const checkoutStatus = searchParams.get("checkout");
  const checkoutRequired = searchParams.get("checkout_required") === "true";
  const showCancelledAlert = !hasDismissedCheckoutAlert && checkoutStatus === "cancelled";
  const hasActiveSubscription = subscriptionStatus === "ACTIVE" || subscriptionStatus === "TRIALING";
  const hasIncompleteSubscription = subscriptionStatus === "INCOMPLETE" || subscriptionStatus === "INCOMPLETE_EXPIRED";
  const priceConfigured = hasCheckedPriceConfig ? isPriceConfigured(priceIds) : true;
  const isDevelopment = process.env.NODE_ENV !== "production";
  const plans = useMemo(() => buildPlans(priceIds), [priceIds]);

  useEffect(() => {
    // Fetch price IDs from server at runtime so they don't need to be baked
    // into the client bundle as NEXT_PUBLIC_ vars.
    fetch("/api/stripe/config")
      .then((r) => r.json())
      .then((data) => {
        // Merge server values over any build-time values — server wins if set
        setPriceIds((prev) => ({
          standardMonthly: data.standardMonthly || prev.standardMonthly,
          standardAnnual:  data.standardAnnual  || prev.standardAnnual,
          teamMonthly:     data.teamMonthly      || prev.teamMonthly,
          teamAnnual:      data.teamAnnual       || prev.teamAnnual,
          plusMonthly:     data.plusMonthly      || prev.plusMonthly,
          plusAnnual:      data.plusAnnual       || prev.plusAnnual,
        }));
      })
      .catch(() => {
        // Fall back silently to whatever build-time values we have
      })
      .finally(() => {
        setHasCheckedPriceConfig(true);
        setLoadingPriceIds(false);
      });
  }, []);

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

    if (hasActiveSubscription) {
      router.push("/dashboard");
      return;
    }

    if (sessionStatus === "loading") {
      setError("Please wait while we confirm your account. Try again in a moment.");
      return;
    }

    if (sessionStatus !== "authenticated" || !session?.user) {
      router.push("/login?callbackUrl=/onboarding/plans");
      return;
    }

    const priceId = billing === "monthly" ? plan.monthlyPriceId : plan.annualPriceId;

    if (!priceId || !isValidPriceId(priceId)) {
      if (loadingPriceIds) {
        setError("Loading plan details — please try again in a moment.");
      } else {
        setError("This plan is not available right now. Please try again or contact support.");
      }
      return;
    }

    setLoadingKey(planKey);

    const timeoutId = window.setTimeout(() => {
      setLoadingKey(null);
      setError("The request timed out. Please try again.");
    }, 15000);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, isOnboarding: true }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.error) {
        const msg = data?.error || "Unable to start checkout. Please try again.";
        console.error("Stripe checkout session error:", msg);
        setError(isDevelopment ? msg : "Unable to start checkout. Please try again or contact support.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      setError("No checkout URL was returned. Please try again or contact support.");
    } catch (err: unknown) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again or contact support.");
    } finally {
      clearTimeout(timeoutId);
      setLoadingKey(null);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px">
        <BookDemoButton calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/opletics/30min"} />
      </BaseHeader>
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
          <span className={styles.PlansTitle} style={{ fontWeight: 700, fontStyle: "normal" }}>
            Choose the automation you need
          </span>
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          or get an assist from one of our experts
        </Typography>

        <Box sx={{ maxWidth: 800, mx: "auto", mt: 0 }}>
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
                Set <code>NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO</code> in your <code>.env.local</code> file
              </li>
              <li>
                Set <code>NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO</code> in your <code>.env.local</code> file
              </li>
              <li>
                Set <code>NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO</code> in your <code>.env.local</code> file
              </li>
            </Box>
            <Typography variant="caption" color="text.secondary">
              See <code>docs/STRIPE_QUICK_START.md</code> for setup instructions.
            </Typography>
          </Alert>
        )}

        {checkoutRequired && !hasActiveSubscription && (
          <Alert severity="info" sx={{ mt: 3, mb: 3, maxWidth: 640, mx: "auto" }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              One more step — start your free trial
            </Typography>
            <Typography variant="body2">
              Select a plan below to activate your 2-week free trial. You won&apos;t be charged until the trial ends, and you can cancel anytime.
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

        {hasIncompleteSubscription && (
          <Alert severity="info" sx={{ mt: 3, mb: 3, maxWidth: 600, mx: "auto" }}>
            You have an incomplete subscription. You can select a plan below to complete your subscription. If you're experiencing issues, please contact support.
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
            const buttonDisabled = Boolean(loadingKey);
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
      <TopFooter />
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
