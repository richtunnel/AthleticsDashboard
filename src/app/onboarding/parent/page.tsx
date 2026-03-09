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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { School, Sports, EmojiEvents } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";

interface School {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

interface Sport {
  id: string;
  name: string;
}

const steps = ["Child's Information", "Select Coach", "Choose Plan"];

export default function ParentOnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");

  // Data state
  const [schools, setSchools] = useState<School[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/onboarding/signup?plan=parent_plan");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      const [schoolsRes, sportsRes] = await Promise.all([
        fetch("/api/schools"),
        fetch("/api/sports"),
      ]);

      if (schoolsRes.ok) {
        const schoolsData = await schoolsRes.json();
        setSchools(schoolsData);
      }

      if (sportsRes.ok) {
        const sportsData = await sportsRes.json();
        setSports(sportsData.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load required data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSchool || !selectedSport || !selectedLevel) {
      setError("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Store parent preferences in session/local storage for next step
      const parentPreferences = {
        schoolId: selectedSchool.id,
        schoolName: selectedSchool.name,
        sportId: selectedSport.id,
        sportName: selectedSport.name,
        level: selectedLevel,
      };

      localStorage.setItem("parentOnboardingPrefs", JSON.stringify(parentPreferences));

      // Navigate to coach selection
      router.push("/onboarding/parent/select-coach");
    } catch (err) {
      console.error("Failed to save preferences:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

  const levels = ["Varsity", "Junior Varsity", "Freshman", "Middle School"];

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
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Tell us about your child
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* School Selection */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <School color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Child&apos;s School
                  </Typography>
                </Box>
                <Autocomplete
                  options={schools}
                  getOptionLabel={(option) =>
                    option.city ? `${option.name} (${option.city}, ${option.state})` : option.name
                  }
                  value={selectedSchool}
                  onChange={(_, newValue) => setSelectedSchool(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search for your child's school..."
                      fullWidth
                      size="small"
                    />
                  )}
                />
              </Box>

              {/* Sport Selection */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Sports color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Sport
                  </Typography>
                </Box>
                <Autocomplete
                  options={sports}
                  getOptionLabel={(option) => option.name}
                  value={selectedSport}
                  onChange={(_, newValue) => setSelectedSport(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select sport..."
                      fullWidth
                      size="small"
                    />
                  )}
                />
              </Box>

              {/* Level Selection */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <EmojiEvents color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Sport Level
                  </Typography>
                </Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Select level</InputLabel>
                  <Select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    label="Select level"
                  >
                    {levels.map((level) => (
                      <MenuItem key={level} value={level}>
                        {level}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={submitting || !selectedSchool || !selectedSport || !selectedLevel}
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
