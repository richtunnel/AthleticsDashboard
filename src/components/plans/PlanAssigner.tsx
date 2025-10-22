"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";

export default function PlanAssigner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const assignPlan = async () => {
      // Get plan from URL params or localStorage
      let plan = searchParams.get("plan");

      if (!plan) {
        plan = localStorage.getItem("onboarding_plan");
        localStorage.removeItem("onboarding_plan"); // Clean up
      }

      if (plan) {
        try {
          const response = await fetch("/api/auth/update-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan }),
          });

          if (response.ok) {
            // Redirect to appropriate page based on plan
            if (plan === "free_trial_plan") {
              router.push("/onboarding/details");
            } else {
              // For paid plans, continue with Stripe setup
              router.push(`/onboarding/start?plan=${plan}`);
            }
          } else {
            console.error("Failed to assign plan");
            router.push("/onboarding/plans");
          }
        } catch (error) {
          console.error("Error assigning plan:", error);
          router.push("/onboarding/plans");
        }
      } else {
        // No plan found, redirect to plans page
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
      <CircularProgress size={40} />
      <Typography variant="h6" color="text.secondary">
        Setting up your account...
      </Typography>
    </Box>
  );
}
