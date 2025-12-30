"use client";

import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, CircularProgress, Stack, Alert, Stepper, Step, StepLabel } from "@mui/material";
import { DirectionsBus, Schedule, LocationOn } from "@mui/icons-material";
import SchoolAddressAutocomplete from "@/components/forms/SchoolAddressAutocomplete";
import { useTheme } from "@mui/material/styles";
interface TravelTimeModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  columnName?: string;
  onSave: (departureTime: string, address: string) => void;
}

interface TravelCalculation {
  recommendedDepartureTime: string;
  travelTimeMinutes: number;
  bufferMinutes: number;
  distance?: string;
}

const steps = ["Enter Dismissal Time", "Enter Opponent Address", "Review Recommendation"];

export function TravelTimeModal({ open, onClose, gameId, gameName, columnName, onSave }: TravelTimeModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [dismissalTime, setDismissalTime] = useState("");
  const [opponentAddress, setOpponentAddress] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<TravelCalculation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const handleNext = async () => {
    if (activeStep === 0 && !dismissalTime) {
      setError("Please enter a dismissal or meetup time");
      return;
    }

    if (activeStep === 1) {
      if (!opponentAddress) {
        setError("Please enter the opponent's school address");
        return;
      }
      // Calculate travel time
      await handleCalculate();
    } else {
      setActiveStep((prev) => prev + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch("/api/games/calculate-travel-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          dismissalTime,
          opponentAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle missing school address error
        if (errorData.error === "MISSING_SCHOOL_ADDRESS") {
          throw new Error(errorData.message || "Please enter your school address in settings to calculate accurate travel times");
        }

        throw new Error(errorData.error || "Failed to calculate travel time");
      }

      const result = await response.json();
      setCalculation(result.data);
      setActiveStep(2); // Move to review step
    } catch (err: any) {
      setError(err.message || "Failed to calculate travel time");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = () => {
    if (!calculation) return;
    onSave(calculation.recommendedDepartureTime, opponentAddress);
    handleClose();
  };

  const handleClose = () => {
    setActiveStep(0);
    setDismissalTime("");
    setOpponentAddress("");
    setCalculation(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DirectionsBus />
          <Typography variant="h6">Calculate Travel Time</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {gameName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 1 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ color: theme.palette.mode === "dark" ? theme.palette.themeButtonText.contrast : "" }}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Step 1: Dismissal Time */}
        {activeStep === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              When will the athletes be dismissed or meet up?
            </Typography>
            <TextField
              label="Dismissal or Meetup Time"
              type="time"
              value={dismissalTime}
              onChange={(e) => setDismissalTime(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Enter the time students will be ready to leave"
              autoFocus
            />
          </Stack>
        )}

        {/* Step 2: Opponent Address */}
        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enter the address of the opponent&apos;s school or venue
            </Typography>
            <SchoolAddressAutocomplete
              value={opponentAddress}
              onChange={(value) => setOpponentAddress(value)}
              label="Opponent's School Address"
              placeholder="e.g., 123 Main St, City, State 12345"
              required
              size="medium"
            />
          </Stack>
        )}

        {/* Step 3: Review Recommendation */}
        {activeStep === 2 && (
          <Stack spacing={2}>
            {isCalculating ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : calculation ? (
              <>
                <Box
                  sx={{
                    p: 3,
                    bgcolor: "rgb(119 179 255 / 10%)",
                    borderRadius: 2,
                    border: "1px solid rgba(206, 255, 119, 0.3)",
                    textAlign: "center",
                  }}
                >
                  <Typography variant="caption" sx={{ color: theme.palette.mode === "dark" ? theme.palette.themeText.text : theme.palette.grey[900], display: "block", mb: 1 }}>
                    Recommended Departure Time
                  </Typography>
                  <Typography variant="h3" sx={{ color: theme.palette.mode === "dark" ? theme.palette.themeText.text : theme.palette.grey[900], fontWeight: 600 }}>
                    {calculation.recommendedDepartureTime}
                  </Typography>
                </Box>

                <Box sx={{ p: 2, bgcolor: "rgba(0, 0, 0, 0.02)", borderRadius: 1 }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Schedule fontSize="small" color="action" />
                      <Typography variant="body2">
                        Travel Time: <strong>{calculation.travelTimeMinutes} minutes</strong>
                      </Typography>
                    </Box>
                    {calculation.distance && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2">
                          Distance: <strong>{calculation.distance}</strong>
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <DirectionsBus fontSize="small" color="action" />
                      <Typography variant="body2">
                        Safety Buffer: <strong>{calculation.bufferMinutes} minutes</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                        Destination: <strong>{opponentAddress}</strong>
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Alert severity="info">This recommendation includes a 22-minute safety cushion to ensure on-time arrival.</Alert>
              </>
            ) : null}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          Cancel
        </Button>
        {activeStep > 0 && activeStep < 2 && (
          <Button onClick={handleBack} sx={{ color: "text.secondary" }}>
            Back
          </Button>
        )}
        {activeStep < 2 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={isCalculating}
            sx={{
              color: theme.palette.mode === "dark" ? "#fff" : "",
              bgcolor: "#0f172a",
              "&:hover": { bgcolor: "#1e293b" },
            }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!calculation}
            sx={{
              color: theme.palette.mode === "dark" ? "#fff" : "",
              bgcolor: "#0f172a",
              "&:hover": { bgcolor: "#1e293b" },
            }}
          >
            Save & Finish
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
