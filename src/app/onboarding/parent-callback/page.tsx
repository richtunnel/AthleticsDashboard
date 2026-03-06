"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { 
  Box, 
  Container, 
  Typography, 
  Card, 
  CardContent,
  Alert,
  CircularProgress,
  Button
} from "@mui/material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";

function ParentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const session = await getSession();
      
      if (!session?.user?.email) {
        // Not signed in, redirect to signup
        router.push("/onboarding/parent-signup");
        return;
      }

      // Get stored onboarding data
      const storedData = sessionStorage.getItem("parentOnboardingData");
      let onboardingData = null;
      
      if (storedData) {
        try {
          onboardingData = JSON.parse(storedData);
          sessionStorage.removeItem("parentOnboardingData");
        } catch (e) {
          console.error("Failed to parse onboarding data:", e);
        }
      }

      try {
        // Create the parent link
        const res = await fetch("/api/parent/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(onboardingData || {}),
        });

        if (res.ok) {
          router.push("/parent-dashboard");
        } else {
          const data = await res.json();
          setError(data.error || "Failed to create parent link");
        }
      } catch (err) {
        setError("An error occurred while setting up your account");
      } finally {
        setLoading(false);
      }
    }

    handleCallback();
  }, [router]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ py: 8, px: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Container maxWidth="sm" sx={{ textAlign: "center" }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6">
              Setting up your parent account...
            </Typography>
          </Container>
        </Box>
        <TopFooter />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ py: 8, px: 2, flex: 1 }}>
          <Container maxWidth="sm">
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button 
              variant="contained" 
              onClick={() => router.push("/onboarding/parent")}
            >
              Try Again
            </Button>
          </Container>
        </Box>
        <TopFooter />
      </Box>
    );
  }

  return null;
}

export default function ParentCallbackPage() {
  return (
    <Suspense fallback={
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    }>
      <ParentCallbackContent />
    </Suspense>
  );
}
