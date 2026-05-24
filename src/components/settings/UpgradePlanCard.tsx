"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import {
  Rocket as RocketIcon,
  Check as CheckIcon,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

interface UpgradePlanCardProps {
  userPlan: string | null;
}

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO ?? "";
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR ?? "";

const premiumFeatures = [
  "250,000+ email/mo.",
  "AI Email Generation",
  "Schedule Conflict Detection",
  "Score Tracker & Budget Planner",
  "Email time scheduler +verification",
  "Priority chat and email support",
];

export default function UpgradePlanCard({ userPlan }: UpgradePlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isFreePlan = !userPlan || userPlan === "free" || userPlan === "free_plan";

  // Don't show upgrade card if user already has a paid plan
  if (!isFreePlan) {
    return null;
  }

  const handleUpgrade = async (priceId: string, planType: "monthly" | "annual") => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, isOnboarding: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError(err.message || "Failed to start upgrade. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Card
      sx={{
        mb: 3,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        boxShadow: 3,
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <RocketIcon sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Upgrade to Plus Plan
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Unlock powerful AI features and advanced scheduling tools
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Pricing Options */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <Box
            sx={{
              flex: 1,
              bgcolor: "rgba(255, 255, 255, 0.15)",
              borderRadius: 2,
              p: 2,
              backdropFilter: "blur(10px)",
            }}
          >
            <Typography variant="h4" fontWeight={700}>
              $69.99
              <Typography component="span" variant="body2" sx={{ opacity: 0.8 }}>
                /month
              </Typography>
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5, mb: 2 }}>
              Billed monthly
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                bgcolor: "white",
                color: "#667eea",
                fontWeight: 600,
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.9)" },
              }}
              onClick={() => handleUpgrade(MONTHLY_PRICE_ID, "monthly")}
              disabled={loading || !MONTHLY_PRICE_ID}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? "Processing..." : "Upgrade Monthly"}
            </Button>
          </Box>

          <Box
            sx={{
              flex: 1,
              bgcolor: "rgba(255, 255, 255, 0.2)",
              borderRadius: 2,
              p: 2,
              backdropFilter: "blur(10px)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              position: "relative",
            }}
          >
            <Chip
              label="Save 30%"
              size="small"
              sx={{
                position: "absolute",
                top: -10,
                right: 10,
                bgcolor: "#4caf50",
                color: "white",
                fontWeight: 600,
              }}
            />
            <Typography variant="h4" fontWeight={700}>
              $589
              <Typography component="span" variant="body2" sx={{ opacity: 0.8 }}>
                /year
              </Typography>
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5, mb: 2 }}>
              ~$49/month - Best value
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                bgcolor: "white",
                color: "#667eea",
                fontWeight: 600,
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.9)" },
              }}
              onClick={() => handleUpgrade(ANNUAL_PRICE_ID, "annual")}
              disabled={loading || !ANNUAL_PRICE_ID}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? "Processing..." : "Upgrade Annually"}
            </Button>
          </Box>
        </Stack>

        {/* Features List */}
        <Box sx={{ bgcolor: "rgba(255, 255, 255, 0.1)", borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Premium Features Included:
          </Typography>
          <Stack spacing={0.5}>
            {premiumFeatures.map((feature) => (
              <Box key={feature} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ opacity: 0.95 }}>
                  {feature}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ display: "block", mt: 2, opacity: 0.8 }}>
          All plans include a 2-week free trial. Cancel anytime.
        </Typography>
      </CardContent>
    </Card>
  );
}
