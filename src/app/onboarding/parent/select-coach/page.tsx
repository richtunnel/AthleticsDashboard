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
  Checkbox,
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
} from "@mui/material";
import { School, Person } from "@mui/icons-material";
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
  const { data: session, status } = useSession();
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [parentPrefs, setParentPrefs] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/onboarding/signup?plan=parent_plan");
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

    if (status === "authenticated") {
      fetchCoaches(parsedPrefs.schoolName);
    }
  }, [status, router]);

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

  const handleCoachToggle = (coachId: string) => {
    setSelectedCoachIds((prev) =>
      prev.includes(coachId) ? prev.filter((id) => id !== coachId) : [...prev, coachId]
    );
  };

  const handleSubmit = async () => {
    if (selectedCoachIds.length === 0) {
      setError("Please select at least one coach");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Save selected coaches to the user's profile
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "PARENT",
          parentInfo: {
            ...parentPrefs,
            selectedCoachIds,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save coach selection");
      }

      // Navigate to pricing selection
      router.push("/onboarding/parent/plans");
    } catch (err) {
      console.error("Failed to save coaches:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push("/onboarding/parent");
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <School color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Select Coaches at {parentPrefs?.schoolName}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Check the box next to the coach name that matches your child&apos;s school and sport.
              This helps us connect you to the right schedules.
            </Typography>

            {coaches.length > 0 ? (
              <List>
                {coaches.map((coach, index) => (
                  <Box key={coach.id}>
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => handleCoachToggle(coach.id)} dense>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedCoachIds.includes(coach.id)}
                              onChange={() => handleCoachToggle(coach.id)}
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
                disabled={submitting}
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
