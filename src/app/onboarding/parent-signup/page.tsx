"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { 
  Box, 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField,
  Alert,
  CircularProgress 
} from "@mui/material";
import { Google } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";

function ParentSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the pre-filled data from URL
  const schoolId = searchParams.get("schoolId") || "";
  const sport = searchParams.get("sport") || "";
  const level = searchParams.get("level") || "";
  const childName = searchParams.get("childName") || "";
  const childGrade = searchParams.get("childGrade") || "";

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Store the parent selection data in sessionStorage for after sign up
      sessionStorage.setItem("parentOnboardingData", JSON.stringify({
        schoolId,
        sport,
        level,
        childName,
        childGrade,
      }));
      
      // Redirect to Google signup with callback to handle the link creation
      await signIn("google", { 
        callbackUrl: "/onboarding/parent-callback" 
      });
    } catch (err) {
      setError("Failed to sign up with Google");
      setLoading(false);
    }
  };

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

          {schoolId && (
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
                onClick={() => signIn("google", { callbackUrl: "/onboarding/parent-callback" })}
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
