"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Divider,
  useTheme,
} from "@mui/material";
import { Check, CalendarMonth, Notifications, Sync, VolunteerActivism } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";

const steps = ["Child's Information", "Select Coach", "Choose Plan"];

const freeTierFeatures = ["Calendar sync with your personal calendar", "Mobile notifications for schedule changes", "Real-time schedule updates", "Access to game details and locations"];

const donationTierFeatures = [
  "Calendar sync with your personal calendar",
  "Mobile notifications for schedule changes",
  "Real-time schedule updates",
  "Access to game details and locations",
  "Priority support",
  "Support your school's athletic program",
];

export default function ParentPlansPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"free" | "donation" | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/onboarding/parent-signup");
      return;
    }

    // Check if user has completed previous steps
    const prefs = localStorage.getItem("parentOnboardingPrefs");
    if (!prefs) {
      router.push("/onboarding/parent");
      return;
    }

    if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, router]);

  const handleSelectPlan = async (plan: "free" | "donation") => {
    setSubmitting(true);
    setError("");
    setSelectedPlan(plan);

    try {
      // Get onboarding preferences stored during previous steps
      const prefsStr = localStorage.getItem("parentOnboardingPrefs");
      const prefs = prefsStr ? JSON.parse(prefsStr) : null;

      if (!prefs?.schoolId || !prefs?.childName) {
        setError("Missing onboarding data. Please start over.");
        setSubmitting(false);
        router.push("/onboarding/parent");
        return;
      }

      // 1. Create the ParentAthleteLink (the actual DB record)
      const linkRes = await fetch("/api/parent/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: prefs.schoolId,
          athleteName: prefs.childName,
          sport: prefs.sportName || "",
          gradeLevel: prefs.level || "",
        }),
      });

      if (!linkRes.ok) {
        const linkData = await linkRes.json();
        throw new Error(linkData.error || "Failed to create parent link");
      }

      // 2. Update user's plan selection
      const planRes = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan === "free" ? "parent_free" : "parent_donation",
          donationAmount: plan === "donation" ? 2.5 : 0,
        }),
      });

      if (!planRes.ok) {
        throw new Error("Failed to save plan selection");
      }

      // Clear onboarding preferences now that data is persisted
      localStorage.removeItem("parentOnboardingPrefs");

      // Redirect to parent dashboard
      router.push("/parent-dashboard");
    } catch (err: any) {
      console.error("Failed to complete onboarding:", err);
      setError(err.message || "An error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push("/onboarding/parent/select-coach");
  };

  if (status === "loading" || loading) {
    return (
      <>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textAlign: "center" }}>
          Welcome to Opletics Parent Portal
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
          Stay connected with your child&apos;s athletic schedule
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
            {error}
          </Alert>
        )}

        <Box sx={{ maxWidth: 900, mx: "auto" }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, textAlign: "center" }}>
            Choose Your Plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
            Select the option that works best for you and your family
          </Typography>

          <Grid container spacing={4} justifyContent="center">
            {/* Free Tier */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                elevation={2}
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  border: `2px solid ${theme.palette.divider}`,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", height: "100%" }}>
                  <Box sx={{ textAlign: "center", mb: 3 }}>
                    <Chip label="Free" color="success" size="small" sx={{ mb: 1 }} />
                    <Typography variant="h3" sx={{ fontWeight: 800, color: "#000" }}>
                      $0
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Consider a donation to support your school
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Includes:
                  </Typography>

                  <List dense>
                    {freeTierFeatures.map((feature) => (
                      <ListItem key={feature} disablePadding sx={{ mb: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Check color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ variant: "body2" }} />
                      </ListItem>
                    ))}
                  </List>

                  <Box sx={{ mt: "auto" }}>
                    <Box sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
                      <Chip icon={<Sync />} label="Calendar Sync" size="small" variant="outlined" />
                      <Chip icon={<Notifications />} label="Notifications" size="small" variant="outlined" />
                    </Box>

                    <Button fullWidth variant="outlined" size="large" onClick={() => handleSelectPlan("free")} disabled={submitting} sx={{ mt: 3, py: 1.5 }}>
                      {submitting && selectedPlan === "free" ? <CircularProgress size={24} /> : "Get Started Free"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Donation Tier */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                elevation={4}
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  border: `2px solid ${theme.palette.primary.main}`,
                  position: "relative",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: theme.shadows[12],
                  },
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    bgcolor: theme.palette.primary.main,
                    color: "white",
                    fontSize: 12,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  Supports Your School
                </Box>

                <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", height: "100%" }}>
                  <Box sx={{ textAlign: "center", mb: 3 }}>
                    <Chip icon={<VolunteerActivism />} label="Donation" color="primary" size="small" sx={{ mb: 1 }} />
                    <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                      $2.50
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      per month
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Everything in Free, plus:
                  </Typography>

                  <List dense>
                    {donationTierFeatures.slice(4).map((feature) => (
                      <ListItem key={feature} disablePadding sx={{ mb: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Check color="primary" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={feature} primaryTypographyProps={{ variant: "body2" }} />
                      </ListItem>
                    ))}
                  </List>

                  <Box sx={{ mt: "auto" }}>
                    <Box sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
                      <Chip icon={<CalendarMonth />} label="Calendar Sync" size="small" color="primary" variant="outlined" />
                      <Chip icon={<VolunteerActivism />} label="Supports Athletics" size="small" color="primary" variant="outlined" />
                    </Box>

                    <Button fullWidth variant="contained" size="large" onClick={() => handleSelectPlan("donation")} disabled={submitting} sx={{ mt: 3, py: 1.5 }}>
                      {submitting && selectedPlan === "donation" ? <CircularProgress size={24} /> : "Choose Donation Plan"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-start" }}>
            <Button variant="text" size="large" onClick={handleBack} disabled={submitting}>
              Back
            </Button>
          </Box>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              All plans include real-time schedule updates and calendar synchronization.
              <br />
              Cancel or change your plan anytime.
            </Typography>
          </Box>
        </Box>
      </Container>
      <div style={{ borderTop: "1px solid rgb(197, 197, 210)", paddingTop: "10px" }}>
        <TopFooter />
      </div>
    </>
  );
}
