"use client";

import { useState, useEffect, useCallback } from "react";
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
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { School, Sports, EmojiEvents, Person } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import { mergeSports, mergeLevels, STANDARD_LEVELS } from "@/lib/utils/parentSportsData";

interface SchoolOption {
  id: string;
  name: string;
  state?: string;
  athleticDirectorId?: string;
  athleticDirectorName?: string;
}

/** Sport as returned by /api/parent/sports */
interface Sport {
  id: string;        // "<sportId>-<GENDER|COED>" — unique key
  name: string;      // Display label: "Girls Basketball", "Boys Basketball", etc.
  sportName: string; // Raw sport name for matching: "Basketball"
  gender: string | null;
}

interface LevelOption {
  id: string;   // Stored value — matches CalendarSyncRequest.sportLevel (e.g. "VARSITY FEMALE")
  name: string; // Display: "Varsity", "Junior Varsity (JV)", "Frosh", "Freshman"
}

const steps = ["Child's Information", "Select Coach", "Choose Plan"];

export default function ParentOnboardingPage() {
  const router = useRouter();
  // Use the parent session endpoint instead of next-auth/react useSession().
  // Parent users authenticate via /api/auth/parent/... which sets a separate
  // "parent-session-token" cookie. useSession() only reads the main
  // "next-auth.session-token", so it always returns "unauthenticated" for
  // pure parent users and creates an infinite redirect loop with parent-signup.
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [childName, setChildName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LevelOption | null>(null);

  // Data state — sports pre-populated with full list immediately
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [sports, setSports] = useState<Sport[]>(mergeSports([]));
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [loadingSports, setLoadingSports] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Check the PARENT session (not the main AD session) on mount.
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
    if (authStatus === "authenticated") {
      // Guard: if this parent already has linked students, skip onboarding
      // and send them straight to the dashboard.
      fetch("/api/parent/linked-schools")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.schools && data.schools.length > 0) {
            router.push("/parent-dashboard");
          } else {
            fetchSchools();
          }
        })
        .catch(() => {
          // If the check fails, just show the onboarding form
          fetchSchools();
        });
    }
  }, [authStatus, router]);

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

            // Restore level (use id/stored value, fall back to name for legacy)
            if (prefs.selectedLevel || prefs.level) {
              const storedId = prefs.selectedLevel || prefs.level;
              // Build a minimal LevelOption; real options are loaded after sport restore
              setSelectedLevel({ id: storedId, name: storedId });
            }
            if (prefs.schoolId) {
              const matchedSchool = schoolsList.find((s) => s.id === prefs.schoolId);
              if (matchedSchool) {
                setSelectedSchool(matchedSchool);
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
      const apiSports: Sport[] = res.ok ? (await res.json()).sports || [] : [];
      // Always show the full list merged with any school-specific sports
      const merged = mergeSports(apiSports);
      setSports(merged);

      // Restore saved sport selection if provided
      if (savedPrefs?.sportId || savedPrefs?.sportName) {
        const matchedSport = merged.find(
          (s) => s.id === savedPrefs.sportId || s.name === savedPrefs.sportName
        );
        if (matchedSport) {
          setSelectedSport(matchedSport);
          await fetchLevelsForSport(schoolId, matchedSport.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sports:", err);
      setSports(mergeSports([]));
    } finally {
      setLoadingSports(false);
    }
  };

  /**
   * Fetch levels for a sport+gender combo.
   * `sportName` is the raw sport name (e.g. "Basketball"), not the display name.
   * `gender` is "MALE" | "FEMALE" | null.
   */
  const fetchLevelsForSport = async (
    schoolId: string,
    sportName: string,
    gender: string | null,
  ) => {
    setLoadingLevels(true);
    try {
      const params = new URLSearchParams({
        schoolId,
        sport: sportName,
      });
      if (gender) params.append("gender", gender);

      const res = await fetch(`/api/parent/sport-levels?${params}`);
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
      setSelectedSport(null);
      setSelectedLevel(null);
      setLevels([]);
      if (newValue) {
        fetchSportsForSchool(newValue.id);
      } else {
        setSports(mergeSports([]));
      }
    },
    [],
  );

  const handleSportChange = useCallback(
    (_: any, newValue: Sport | null) => {
      setSelectedSport(newValue);
      setSelectedLevel(null);
      setLevels([]);
      if (newValue && selectedSchool) {
        fetchLevelsForSport(selectedSchool.id, newValue.sportName, newValue.gender);
      }
    },
    [selectedSchool],
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
        // Store the sport ID (new format) for restoration on revisit
        sportId: selectedSport.id,
        // Base sport name (e.g. "Basketball") — used for CalendarSyncRequest.sportName matching
        sportName: selectedSport.sportName,
        // Display name (e.g. "Girls Basketball") — for UI only
        sportDisplayName: selectedSport.name,
        // Level ID is the stored value (e.g. "VARSITY FEMALE") that matches CalendarSyncRequest.sportLevel
        level: selectedLevel.id,
        selectedLevel: selectedLevel.id,
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

  // Merge API levels (normalized by the API) with the standard fallback list
  const levelOptions = mergeLevels(levels);

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

              {/* Sport Selection — full list always available */}
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
                  isOptionEqualToValue={(option, value) => option.name === value.name}
                  loading={loadingSports}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search or select a sport..."
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

              {/* Level Selection — "Varsity", "Junior Varsity (JV)", "Frosh", "Freshman" */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <EmojiEvents color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Sport Level
                  </Typography>
                </Box>
                <Autocomplete
                  options={levelOptions}
                  getOptionLabel={(option) => option.name}
                  value={selectedLevel}
                  onChange={(_: any, newValue: LevelOption | null) => setSelectedLevel(newValue)}
                  isOptionEqualToValue={(option, value) => option.name === value.name}
                  disabled={!selectedSport}
                  loading={loadingLevels}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={selectedSport ? "Select level…" : "Select a sport first"}
                      fullWidth
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingLevels ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Box>
            </Box>

            <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSubmit}
                disabled={submitting || !childName.trim() || !selectedSchool || !selectedSport || !selectedLevel}
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
