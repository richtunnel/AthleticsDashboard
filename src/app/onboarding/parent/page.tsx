"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { 
  Box, 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Grid2 as Grid,
  Stepper, 
  Step, 
  StepLabel,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup
} from "@mui/material";
import { Google } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import Footer from "@/components/layout/Footer";
import styles from "@/styles/onboarding.module.css";

// Steps for parent onboarding
const parentSteps = ['Select School', 'Select Sport', 'Confirm Athletic Director'];

interface SchoolOption {
  id: string;
  name: string;
  state: string;
  athleticDirectorId: string;
  athleticDirectorName: string;
}

interface SportOption {
  id: string;
  name: string;
}

interface SportLevelOption {
  id: string;
  name: string;
}

function ParentOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [sportLevels, setSportLevels] = useState<SportLevelOption[]>([]);
  
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [selectedSportLevel, setSelectedSportLevel] = useState<string>("");
  const [childName, setChildName] = useState<string>("");
  const [childGrade, setChildGrade] = useState<string>("");
  const [adConfirmed, setAdConfirmed] = useState(false);
  
  const [showPricing, setShowPricing] = useState(false);

  // Fetch schools (organizations)
  useEffect(() => {
    async function fetchSchools() {
      try {
        const res = await fetch("/api/parent/schools");
        if (res.ok) {
          const data = await res.json();
          setSchools(data.schools || []);
        }
      } catch (err) {
        console.error("Failed to fetch schools:", err);
      }
    }
    fetchSchools();
  }, []);

  // Fetch sports when school is selected
  useEffect(() => {
    async function fetchSports() {
      if (!selectedSchool) return;
      try {
        const res = await fetch(`/api/parent/sports?schoolId=${selectedSchool.id}`);
        if (res.ok) {
          const data = await res.json();
          setSports(data.sports || []);
        }
      } catch (err) {
        console.error("Failed to fetch sports:", err);
      }
    }
    fetchSports();
  }, [selectedSchool]);

  // Fetch sport levels when sport is selected
  useEffect(() => {
    async function fetchSportLevels() {
      if (!selectedSchool || !selectedSport) return;
      try {
        const res = await fetch(`/api/parent/sport-levels?schoolId=${selectedSchool.id}&sport=${encodeURIComponent(selectedSport)}`);
        if (res.ok) {
          const data = await res.json();
          setSportLevels(data.levels || []);
        }
      } catch (err) {
        console.error("Failed to fetch sport levels:", err);
      }
    }
    fetchSportLevels();
  }, [selectedSchool, selectedSport]);

  const handleNext = () => {
    setError(null);
    
    if (activeStep === 0) {
      // School selection step
      if (!selectedSchool) {
        setError("Please select a school");
        return;
      }
    } else if (activeStep === 1) {
      // Sport & level selection step
      if (!selectedSport || !selectedSportLevel) {
        setError("Please select both sport and level");
        return;
      }
    } else if (activeStep === 2) {
      // AD confirmation step
      if (!childName.trim()) {
        setError("Please enter your child's name");
        return;
      }
      if (!adConfirmed) {
        setError("Please confirm the athletic director is correct");
        return;
      }
      // Show pricing after confirming
      setShowPricing(true);
      return;
    }
    
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const handleGoogleSignUp = async () => {
    if (!session) {
      // Redirect to parent signup first
      router.push("/onboarding/parent-signup?schoolId=" + selectedSchool?.id + 
        "&sport=" + encodeURIComponent(selectedSport) + 
        "&level=" + encodeURIComponent(selectedSportLevel) +
        "&childName=" + encodeURIComponent(childName) +
        "&childGrade=" + encodeURIComponent(childGrade));
      return;
    }
    
    // User is already signed in, create the parent link
    await createParentLink();
  };

  const createParentLink = async () => {
    if (!session?.user?.email) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/parent/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: selectedSchool?.id,
          schoolName: selectedSchool?.name,
          athleticDirectorId: selectedSchool?.athleticDirectorId,
          athleticDirectorName: selectedSchool?.athleticDirectorName,
          sportName: selectedSport,
          sportLevel: selectedSportLevel,
          childName,
          childGrade
        })
      });
      
      if (res.ok) {
        // Redirect to parent dashboard
        router.push("/parent-dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create parent link");
      }
    } catch (err) {
      setError("Failed to create parent link");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: string) => {
    // For parent, we only have one plan
    // Create the link and redirect to dashboard
    createParentLink();
  };

  if (showPricing) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ py: 4, px: 2, textAlign: "center", flex: 1 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Parent Power
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Get real-time game updates synced to your personal calendar
          </Typography>
          
          <Card 
            elevation={8} 
            sx={{ 
              maxWidth: 500, 
              mx: "auto", 
              mt: 4, 
              borderRadius: 2,
              border: `2px solid #1976d2`
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 700 }}>
                Special Offer
              </Typography>
              <Typography variant="h2" fontWeight={700} sx={{ mb: 1 }}>
                1 Month Free Trial
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
                $2.25<span style={{ fontSize: "1rem", fontWeight: 400 }}>/month</span>
              </Typography>
              
              <Box sx={{ textAlign: "left", mb: 3 }}>
                {["Calendar sync with Google Calendar", "Mobile notifications for schedule updates", "Real-time game schedule access", "Cancel anytime"].map((feature) => (
                  <Box key={feature} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Checkbox checked readOnly size="small" />
                    <Typography variant="body2">{feature}</Typography>
                  </Box>
                ))}
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Selected: {selectedSchool?.name} - {selectedSport} ({selectedSportLevel})
              </Typography>
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Google />}
                onClick={handleGoogleSignUp}
                disabled={loading}
                sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem" }}
              >
                {loading ? <CircularProgress size={24} /> : session ? "Continue with Google" : "Sign up with Google"}
              </Button>
              
              {session && (
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  onClick={handleSelectPlan}
                  disabled={loading}
                  sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem", mt: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : "Continue to Dashboard"}
                </Button>
              )}
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => setShowPricing(false)} 
            sx={{ mt: 3 }}
          >
            Go Back
          </Button>
        </Box>
        <TopFooter />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ py: 4, px: 2, flex: 1 }}>
        <Container maxWidth="md">
          <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
            Set Up Your Parent Portal
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
            Follow the steps below to connect to your child's game schedule
          </Typography>
          
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {parentSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <Card sx={{ p: 3 }}>
            {activeStep === 0 && (
              // Step 1: Select School
              <Box>
                <Typography variant="h6" gutterBottom>
                  Select Your Child's School
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>School</InputLabel>
                  <Select
                    value={selectedSchool?.id || ""}
                    label="School"
                    onChange={(e) => {
                      const school = schools.find(s => s.id === e.target.value);
                      setSelectedSchool(school || null);
                    }}
                  >
                    {schools.map((school) => (
                      <MenuItem key={school.id} value={school.id}>
                        {school.name} ({school.state})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
            {activeStep === 1 && (
              // Step 2: Select Sport and Level
              <Box>
                <Typography variant="h6" gutterBottom>
                  Select Sport and Level
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Sport</InputLabel>
                      <Select
                        value={selectedSport}
                        label="Sport"
                        onChange={(e) => {
                          setSelectedSport(e.target.value);
                          setSelectedSportLevel("");
                        }}
                      >
                        {sports.map((sport) => (
                          <MenuItem key={sport.id} value={sport.name}>
                            {sport.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth disabled={!selectedSport}>
                      <InputLabel>Level</InputLabel>
                      <Select
                        value={selectedSportLevel}
                        label="Level"
                        onChange={(e) => setSelectedSportLevel(e.target.value)}
                      >
                        {sportLevels.map((level) => (
                          <MenuItem key={level.id} value={level.name}>
                            {level.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            )}
            
            {activeStep === 2 && (
              // Step 3: Confirm AD and enter child info
              <Box>
                <Typography variant="h6" gutterBottom>
                  Confirm and Enter Child Information
                </Typography>
                
                <Box sx={{ mb: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Athletic Director
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedSchool?.athleticDirectorName || "Unknown"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSchool?.name}
                  </Typography>
                </Box>
                
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={adConfirmed} 
                      onChange={(e) => setAdConfirmed(e.target.checked)} 
                    />
                  }
                  label="I confirm this is the correct school and athletic director"
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Child's Name"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  sx={{ mb: 2 }}
                />
                
                <FormControl fullWidth>
                  <InputLabel>Grade</InputLabel>
                  <Select
                    value={childGrade}
                    label="Grade"
                    onChange={(e) => setChildGrade(e.target.value)}
                  >
                    {["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        Grade {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
            
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
              <Button 
                disabled={activeStep === 0} 
                onClick={handleBack}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext}
              >
                {activeStep === parentSteps.length - 1 ? "Continue to Pricing" : "Next"}
              </Button>
            </Box>
          </Card>
        </Container>
      </Box>
      <TopFooter />
    </Box>
  );
}

export default function ParentOnboardingPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}>
      <ParentOnboardingContent />
    </Suspense>
  );
}
