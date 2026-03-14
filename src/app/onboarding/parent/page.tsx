"use client";

import { useState, useEffect, useCallback } from "react";
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
import { School, Sports, EmojiEvents, Person } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";

interface SchoolOption {
  id: string;
  name: string;
  state?: string;
  athleticDirectorId?: string;
  athleticDirectorName?: string;
}

interface Sport {
  id: string;
  name: string;
}

interface LevelOption {
  id: string;
  name: string;
}

const steps = ["Child's Information", "Select Coach", "Choose Plan"];
const FALLBACK_LEVELS = ["Varsity", "Junior Varsity", "Freshman", "Middle School"];

export default function ParentOnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [childName, setChildName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");

  // Data state
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [loadingSports, setLoadingSports] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/onboarding/parent-signup");
      return;
    }

    if (status === "authenticated") {
      fetchSchools();
    }
  }, [status, router]);

  const fetchSchools = async () => {
    try {
      const res = await fetch("/api/parent/schools");
      if (res.ok) {
        const data = await res.json();
        const schoolsList: SchoolOption[] = data.schools || [];
        setSchools(schoolsList);

        // Restore saved preferences from localStorage
        const saved = localStorage.getItem("parentOnboardingPrefs");
        if (saved) {
          try {
            const prefs = JSON.parse(saved);
            if (prefs.childName) setChildName(prefs.childName);
            if (prefs.selectedLevel || prefs.level) setSelectedLevel(prefs.selectedLevel || prefs.level);

            // Restore school selection
            if (prefs.schoolId) {
              const matchedSchool = schoolsList.find((s) => s.id === prefs.schoolId);
              if (matchedSchool) {
                setSelectedSchool(matchedSchool);
                // Fetch sports for this school, then restore sport selection
                await fetchSportsForSchool(matchedSchool.id, prefs);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch schools:", err);
      setError("Failed to load required data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSportsForSchool = async (schoolId: string, savedPrefs?: any) => {
    setLoadingSports(true);
    try {
      const res = await fetch(`/api/parent/sports?schoolId=${encodeURIComponent(schoolId)}`);
      if (res.ok) {
        const data = await res.json();
        const sportsList: Sport[] = data.sports || [];
        setSports(sportsList);

        // Restore saved sport selection if provided
        if (savedPrefs?.sportId) {
          const matchedSport = sportsList.find((s) => s.id === savedPrefs.sportId);
          if (matchedSport) {
            setSelectedSport(matchedSport);
            // Fetch levels for this sport
            await fetchLevelsForSport(schoolId, matchedSport.name);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch sports:", err);
    } finally {
      setLoadingSports(false);
    }
  };

  const fetchLevelsForSport = async (schoolId: string, sportName: string) => {
    setLoadingLevels(true);
    try {
      const res = await fetch(
        `/api/parent/sport-levels?schoolId=${encodeURIComponent(schoolId)}&sport=${encodeURIComponent(sportName)}`
      );
      if (res.ok) {
        const data = await res.json();
        const levelsList: LevelOption[] = data.levels || [];
        setLevels(levelsList);
      }
    } catch (err) {
      console.error("Failed to fetch levels:", err);
    } finally {
      setLoadingLevels(false);
    }
  };

  const handleSchoolChange = useCallback(
    (_: any, newValue: SchoolOption | null) => {
      setSelectedSchool(newValue);
      // Clear dependent selections
      setSelectedSport(null);
      setSports([]);
      setSelectedLevel("");
      setLevels([]);

      if (newValue) {
        fetchSportsForSchool(newValue.id);
      }
    },
    []
  );

  const handleSportChange = useCallback(
    (_: any, newValue: Sport | null) => {
      setSelectedSport(newValue);
      // Clear dependent selection
      setSelectedLevel("");
      setLevels([]);

      if (newValue && selectedSchool) {
        fetchLevelsForSport(selectedSchool.id, newValue.name);
      }
    },
    [selectedSchool]
  );

  const handleSubmit = async () => {
    if (!childName || !selectedSchool || !selectedSport || !selectedLevel) {
      setError("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const parentPreferences = {
        childName,
        schoolId: selectedSchool.id,
        schoolName: selectedSchool.name,
        athleticDirectorId: selectedSchool.athleticDirectorId || "",
        athleticDirectorName: selectedSchool.athleticDirectorName || "",
        sportId: selectedSport.id,
        sportName: selectedSport.name,
        level: selectedLevel,
        selectedLevel,
      };

      localStorage.setItem("parentOnboardingPrefs", JSON.stringify(parentPreferences));
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

  // Use dynamic levels from API, fall back to hardcoded if none available
  const levelOptions = levels.length > 0 ? levels : FALLBACK_LEVELS.map((l) => ({ id: l, name: l }));

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
              {/* Child's Name */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Person color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Child&apos;s Name
                  </Typography>
                </Box>
                <TextField
                  placeholder="Enter your child's full name..."
                  fullWidth
                  size="small"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
              </Box>

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
                  getOptionLabel={(option) => option.name}
                  value={selectedSchool}
                  onChange={handleSchoolChange}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
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
                  onChange={handleSportChange}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  disabled={!selectedSchool}
                  loading={loadingSports}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={selectedSchool ? "Select sport..." : "Select a school first"}
                      fullWidth
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingSports ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
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
                <FormControl fullWidth size="small" disabled={!selectedSport}>
                  <InputLabel>{selectedSport ? "Select level" : "Select a sport first"}</InputLabel>
                  <Select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    label={selectedSport ? "Select level" : "Select a sport first"}
                  >
                    {loadingLevels ? (
                      <MenuItem disabled>
                        <CircularProgress size={16} sx={{ mr: 1 }} /> Loading...
                      </MenuItem>
                    ) : (
                      levelOptions.map((level) => (
                        <MenuItem key={level.id} value={level.name}>
                          {level.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={submitting || !childName || !selectedSchool || !selectedSport || !selectedLevel}
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
