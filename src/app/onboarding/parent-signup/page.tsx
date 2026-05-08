"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Chip
} from "@mui/material";
import { Google, School, Person } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";

/**
 * Sign in via the parent auth endpoint (/api/auth/parent/...) instead of the
 * main NextAuth endpoint (/api/auth/...).  Using the main endpoint would route
 * errors to /login (the AD sign-in page) and could cause OAuthAccountNotLinked
 * because the parent flow uses a separate Google OAuth client ID.
 */
async function signInAsParent(callbackUrl: string): Promise<void> {
  // 1. Fetch a CSRF token from the PARENT auth endpoint
  const csrfRes = await fetch("/api/auth/parent/csrf");
  if (!csrfRes.ok) throw new Error("Failed to fetch CSRF token");
  const { csrfToken } = await csrfRes.json();

  // 2. POST to the parent OAuth sign-in endpoint — mirrors what next-auth/react
  //    signIn() does internally, just targeting the parent auth base path so
  //    errors redirect to /onboarding/parent-signup and allowDangerousEmailAccountLinking
  //    is active.
  const res = await fetch("/api/auth/parent/signin/google", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, callbackUrl, json: "true" }).toString(),
  });

  if (!res.ok) throw new Error("Failed to initiate Google sign-in");

  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
}

interface AthleticDirectorInfo {
  athleticDirectorId: string;
  athleticDirectorName: string;
  schoolId: string;
  schoolName: string;
  organizationName: string;
}

function ParentSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adInfo, setAdInfo] = useState<AthleticDirectorInfo | null>(null);
  const [loadingAdInfo, setLoadingAdInfo] = useState(false);

  // Get the share code from URL
  const shareCode = searchParams.get("code") || "";

  // Get the pre-filled data from URL
  const schoolId = searchParams.get("schoolId") || "";
  const sport = searchParams.get("sport") || "";
  const level = searchParams.get("level") || "";
  const childName = searchParams.get("childName") || "";
  const childGrade = searchParams.get("childGrade") || "";

  // If NextAuth redirected back here with an error param, surface it
  useEffect(() => {
    const authError = searchParams.get("error");
    if (authError) {
      const messages: Record<string, string> = {
        OAuthAccountNotLinked: "This Google account is linked to a different sign-in method. Please try signing in with the same account you used originally.",
        OAuthSignin: "There was a problem signing in with Google. Please try again.",
        OAuthCallback: "There was a problem completing Google sign-in. Please try again.",
        Default: "Sign-in failed. Please try again.",
      };
      setError(messages[authError] ?? messages.Default);
    }
  }, [searchParams]);

  // If user already has a parent session, redirect to parent onboarding.
  // Note: With separate parent auth cookies, an AD logged in via the main
  // cookie will NOT trigger this — only an existing parent session will.
  // This allows parents to sign up on the same browser as a logged-in AD.
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.push("/onboarding/parent");
    }
  }, [status, session, router]);

  // Fetch AD info if share code is present
  useEffect(() => {
    if (shareCode) {
      setLoadingAdInfo(true);
      fetch(`/api/parent/share-code/lookup?code=${shareCode}`)
        .then(res => res.json())
        .then(data => {
          if (data.athleticDirectorId) {
            setAdInfo(data);
            // Store in session storage for the callback
            sessionStorage.setItem("parentReferralData", JSON.stringify({
              shareCode,
              athleticDirectorId: data.athleticDirectorId,
              athleticDirectorName: data.athleticDirectorName,
              schoolId: data.schoolId,
              schoolName: data.schoolName,
              organizationName: data.organizationName,
            }));
          }
        })
        .catch(err => console.error("Failed to fetch AD info:", err))
        .finally(() => setLoadingAdInfo(false));
    }
  }, [shareCode]);

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Store any pre-filled data from AD share links in sessionStorage for after sign up
      // This allows skipping straight to coach selection if data is complete
      if (adInfo || schoolId) {
        sessionStorage.setItem("parentOnboardingData", JSON.stringify({
          schoolId: schoolId || adInfo?.schoolId || "",
          sport,
          level,
          childName,
          childGrade,
          // Include AD info if available
          athleticDirectorId: adInfo?.athleticDirectorId || "",
          athleticDirectorName: adInfo?.athleticDirectorName || "",
        }));
      }
      
      // Redirect to Google sign-up via the PARENT auth endpoint so that errors
      // land on /onboarding/parent-signup (not the AD /login page) and
      // allowDangerousEmailAccountLinking is in effect.
      await signInAsParent("/onboarding/parent-callback");
    } catch (err) {
      setError("Failed to sign up with Google");
      setLoading(false);
    }
  };

  if (loadingAdInfo) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Determine the school to show
  const displaySchool = adInfo?.schoolName || "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ py: 8, px: 2, flex: 1 }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
            Create Your Parent Account
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            Sign up to access your child's game schedule
          </Typography>

          {/* Show pre-filled school info if coming from AD's share link */}
          {adInfo && (
            <Card sx={{ mb: 3, bgcolor: "primary.50", border: "1px solid", borderColor: "primary.main" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <School color="primary" />
                  <Typography variant="subtitle2" color="primary">
                    Connected School
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={600}>
                  {adInfo.schoolName}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Athletic Director: {adInfo.athleticDirectorName}
                  </Typography>
                </Box>
                <Chip 
                  label="Pre-selected for you" 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          )}

          {schoolId && !adInfo && (
            <Card sx={{ mb: 3, bgcolor: "grey.50" }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">
                  Your Selection
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {childName && `${childName} - `}{sport} ({level})
                </Typography>
                {childGrade && (
                  <Typography variant="body2" color="text.secondary">
                    Grade: {childGrade}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Continue with Google to create your account and connect to your child's schedule
            </Typography>
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Google />}
              onClick={handleGoogleSignUp}
              disabled={loading}
              sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem" }}
            >
              {loading ? "Signing up..." : "Sign up with Google"}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Already have an account?{" "}
              <Button
                variant="text"
                size="small"
                onClick={() => signInAsParent("/parent-dashboard").catch(console.error)}
              >
                Sign in instead
              </Button>
            </Typography>
          </Card>
        </Container>
      </Box>
      <TopFooter />
    </Box>
  );
}

export default function ParentSignupPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}>
      <ParentSignupContent />
    </Suspense>
  );
}
