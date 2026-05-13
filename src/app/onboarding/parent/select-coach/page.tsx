"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Radio,
  FormControlLabel,
  CircularProgress,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  Chip,
} from "@mui/material";
import { School, Person, Sports, EmojiEvents } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";

interface Coach {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolName?: string;
}

const steps = ["Child's Information", "Select Coach", "Choose Plan"];

export default function SelectCoachPage() {
  const router = useRouter();
  // Use parent session endpoint directly — parent users only have parent-session-token,
  // not the main next-auth session token, so useSession() always returns "unauthenticated".
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [parentPrefs, setParentPrefs] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Check the PARENT session on mount.
  useEffect(() => {
    fetch("/api/auth/parent/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (session?.user?.email) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      })
      .catch(() => setAuthStatus("unauthenticated"));
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/onboarding/parent-signup");
      return;
    }

    // Load parent preferences from localStorage
    const prefs = localStorage.getItem("parentOnboardingPrefs");
    if (!prefs) {
      router.push("/onboarding/parent");
      return;
    }

    const parsedPrefs = JSON.parse(prefs);
    setParentPrefs(parsedPrefs);

    if (authStatus === "authenticated") {
      fetchCoaches(parsedPrefs.schoolName);
    }
  }, [authStatus, router]);

  const fetchCoaches = async (schoolName: string) => {
    try {
      // Fetch coaches/athletic directors for the selected school
      const res = await fetch(`/api/coaches?school=${encodeURIComponent(schoolName)}`);
      if (res.ok) {
        const data = await res.json();
        setCoaches(data);
      } else {
        // If no specific coaches found, show generic message
        setCoaches([]);
      }
    } catch (err) {
      console.error("Failed to fetch coaches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoachSelect = (coachId: string) => {
    setSelectedCoachId(coachId);
  };

  const handleSubmit = async () => {
    if (!selectedCoachId) {
      setError("Please select a coach to confirm");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Save selected coach to localStorage preferences.
      // Note: Do NOT set role to "PARENT" here — existing users (ADs, coaches, etc.)
      // should keep their primary role. Parent dashboard access is granted via
      // parentAthleteLink records, so no role change is needed.
      const updatedPrefs = {
        ...parentPrefs,
        selectedCoachId,
      };
      localStorage.setItem("parentOnboardingPrefs", JSON.stringify(updatedPrefs));

      // Navigate to pricing selection
      router.push("/onboarding/parent/plans");
    } catch (err) {
      console.error("Failed to save coach:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push("/onboarding/parent");
  };

  if (authStatus === "loading" || loading) {
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
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textAlign: "center" }}>
          Welcome to Opletics Parent Portal
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: "center" }}>
          Stay connected with your child&apos;s athletic schedule
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Card elevation={2}>
          <CardContent sx={{ p: 4 }}>
            {/* School Name Header */}
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Chip 
                icon={<School />} 
                label={parentPrefs?.schoolName} 
                color="primary" 
                size="medium"
                sx={{ fontSize: "1rem", fontWeight: 600, px: 2, py: 1 }}
              />
            </Box>

            {/* Child Info Summary */}
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Your Selection:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip icon={<Person />} label={parentPrefs?.childName} size="small" variant="outlined" />
                <Chip icon={<Sports />} label={parentPrefs?.sportName} size="small" variant="outlined" />
                <Chip icon={<EmojiEvents />} label={parentPrefs?.level} size="small" variant="outlined" />
              </Box>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              Confirm Your Coach
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              We found the following coaches and athletic directors at {parentPrefs?.schoolName}. 
              Please select the radio button next to the name that matches your child&apos;s coach to confirm it is the correct school.
            </Typography>

            {coaches.length > 0 ? (
              <List>
                {coaches.map((coach, index) => (
                  <Box key={coach.id}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleCoachSelect(coach.id)} dense>
                        <FormControlLabel
                          control={
                            <Radio
                              checked={selectedCoachId === coach.id}
                              onChange={() => handleCoachSelect(coach.id)}
                            />
                          }
                          label=""
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ListItemAvatar>
                          <Avatar>
                            <Person />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={coach.name}
                          secondary={`${coach.role} • ${coach.email}`}
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < coaches.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            ) : (
              <Alert severity="info" sx={{ mb: 3 }}>
                We couldn&apos;t find any registered coaches for {parentPrefs?.schoolName} yet. 
                Don&apos;t worry - you can still proceed and we&apos;ll connect you when coaches join.
              </Alert>
            )}

            <Box sx={{ mt: 4, display: "flex", justifyContent: "space-between" }}>
              <Button variant="outlined" size="large" onClick={handleBack} disabled={submitting}>
                Back
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={submitting || !selectedCoachId}
                sx={{ minWidth: 150 }}
              >
                {submitting ? <CircularProgress size={24} /> : "Next"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
