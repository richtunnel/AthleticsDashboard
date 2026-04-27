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
      const returnTo = searchParams.get("returnTo");
      
      if (!session?.user?.email) {
        // Not signed in, redirect to signup
        const signupUrl = returnTo
          ? `/onboarding/parent-signup?returnTo=${encodeURIComponent(returnTo)}`
          : "/onboarding/parent-signup";
        router.push(signupUrl);
        return;
      }

      // Get stored onboarding data
      const storedData = sessionStorage.getItem("parentOnboardingData");
      let onboardingData: Record<string, string> = {};
      
      if (storedData) {
        try {
          onboardingData = JSON.parse(storedData);
          sessionStorage.removeItem("parentOnboardingData");
        } catch (e) {
          console.error("Failed to parse onboarding data:", e);
        }
      }

      // Also get referral data from share code if available
      const referralData = sessionStorage.getItem("parentReferralData");
      if (referralData) {
        try {
          const parsed = JSON.parse(referralData);
          sessionStorage.removeItem("parentReferralData");
          
          // Merge referral data with onboarding data
          // Use referral data as defaults but allow onboarding data to override
          if (!onboardingData.schoolId && parsed.schoolId) {
            onboardingData.schoolId = parsed.schoolId;
          }
          if (!onboardingData.school && parsed.schoolName) {
            onboardingData.school = parsed.schoolName;
          }
          if (!onboardingData.athleticDirectorId && parsed.athleticDirectorId) {
            onboardingData.athleticDirectorId = parsed.athleticDirectorId;
          }
          if (!onboardingData.athleticDirectorName && parsed.athleticDirectorName) {
            onboardingData.athleticDirectorName = parsed.athleticDirectorName;
          }
        } catch (e) {
          console.error("Failed to parse referral data:", e);
        }
      }

      // No onboarding data — could be a returning parent or a fresh signup.
      // Check if they already have parent links before forcing onboarding.
      if (!storedData && !referralData) {
        try {
          const linkRes = await fetch("/api/parent/linked-schools");
          if (linkRes.ok) {
            const linkData = await linkRes.json();
            if (linkData.schools && linkData.schools.length > 0) {
              // Returning parent — skip onboarding
              router.push(returnTo || "/parent-dashboard");
              return;
            }
          }
        } catch {
          // If the check fails, fall through to onboarding
        }
        // Truly new parent with no links — start onboarding
        router.push(returnTo || "/onboarding/parent");
        return;
      }

      try {
        // Map onboarding field names to the create-link API's expected field names
        const createLinkPayload: Record<string, string> = {
          schoolId: onboardingData.schoolId || "",
          athleteName: onboardingData.childName || onboardingData.athleteName || "",
          sport: onboardingData.sport || onboardingData.sportName || "",
          gradeLevel: onboardingData.level || onboardingData.childGrade || onboardingData.gradeLevel || "",
        };

        // Create the parent link
        const res = await fetch("/api/parent/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createLinkPayload),
        });

        if (res.ok) {
          router.push(returnTo || "/parent-dashboard");
        } else {
          const data = await res.json();
          const errMsg = typeof data.error === "string" ? data.error : data.error?.message || "Failed to create parent link";
          setError(errMsg);
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
              onClick={() => router.push(returnTo || "/onboarding/parent")}
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
