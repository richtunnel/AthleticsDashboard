"use client";

import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import PlanAssigner from "@/components/onboarding/PlanAssigner";
import BaseHeader from "@/components/headers/_base";

export default function SetupPage() {
  return (
    <>
      <BaseHeader />
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 8 }}>
        <Suspense 
          fallback={
            <Box 
              sx={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                minHeight: "50vh" 
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <PlanAssigner />
        </Suspense>
      </Box>
    </>
  );
}