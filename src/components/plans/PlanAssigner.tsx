"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";

export default function PlanAssigner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const assignPlan = async () => {
      let plan = searchParams.get("plan");

      if (!plan) {
        plan = localStorage.getItem("onboarding_plan");
        localStorage.removeItem("onboarding_plan");
      }

      if (plan) {
        try {
          if (plan === "free_trial_plan") {
            router.push("/onboarding/start?plan=free_trial_plan");
          } else {
            router.push("/onboarding/plans");
          }
        } catch (error) {
          console.error("Error assigning plan:", error);
          setError("Failed to process plan selection. Redirecting...");
          setTimeout(() => router.push("/onboarding/plans"), 2000);
        }
      } else {
        router.push("/onboarding/plans");
      }
    };

    assignPlan();
  }, [router, searchParams]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        gap: 2,
      }}
    >
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <CircularProgress size={40} />
          <Typography variant="h6" color="text.secondary">
            Setting up your account...
          </Typography>
        </>
      )}
    </Box>
  );
}
