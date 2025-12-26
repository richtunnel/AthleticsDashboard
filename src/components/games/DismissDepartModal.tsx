"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Stack,
  Alert,
  Chip,
} from "@mui/material";
import { DirectionsBus, Schedule, TrendingUp, Cloud, LocationOn } from "@mui/icons-material";

interface DismissDepartModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  currentDismissTime?: string;
  currentDepartTime?: string;
  onSave: (dismissTime: string, departTime: string) => void;
}

interface RecommendationData {
  recommendedDepartureTime: string;
  trafficCondition: string;
  weatherNote: string;
  bufferMinutes: number;
  travelTimeMinutes: number;
  distance?: string;
}

export function DismissDepartModal({
  open,
  onClose,
  gameId,
  gameName,
  currentDismissTime,
  currentDepartTime,
  onSave,
}: DismissDepartModalProps) {
  const [dismissTime, setDismissTime] = useState(currentDismissTime || "");
  const [departTime, setDepartTime] = useState(currentDepartTime || "");
  const [isCalculating, setIsCalculating] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!dismissTime) {
      setError("Please enter a dismissal time");
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch("/api/games/calculate-depart-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, dismissalTime: dismissTime }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle missing school address error
        if (errorData.error?.includes("MISSING_SCHOOL_ADDRESS")) {
          throw new Error("Please enter your school address in settings to calculate accurate travel times");
        }
        
        throw new Error(errorData.error || "Failed to calculate departure time");
      }

      const result = await response.json();
      setRecommendation(result.data);
      setDepartTime(result.data.recommendedDepartureTime);
    } catch (err: any) {
      setError(err.message || "Failed to calculate departure time");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSave = () => {
    if (!dismissTime || !departTime) {
      setError("Both dismissal and departure times are required");
      return;
    }
    onSave(dismissTime, departTime);
    onClose();
  };

  const handleClose = () => {
    setDismissTime(currentDismissTime || "");
    setDepartTime(currentDepartTime || "");
    setRecommendation(null);
    setError(null);
    onClose();
  };

  const getTrafficColor = (condition: string) => {
    switch (condition) {
      case "heavy":
        return "error";
      case "moderate":
        return "warning";
      case "light":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DirectionsBus />
          <Typography variant="h6">Bus Travel Times</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {gameName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Dismissal Time"
            type="time"
            value={dismissTime}
            onChange={(e) => setDismissTime(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="When students are dismissed from school"
          />

          <Button
            variant="outlined"
            onClick={handleCalculate}
            disabled={isCalculating || !dismissTime}
            startIcon={isCalculating ? <CircularProgress size={16} /> : <Schedule />}
            sx={{
              borderColor: "#0f172a",
              color: "#0f172a",
              "&:hover": {
                borderColor: "#0f172a",
                bgcolor: "rgba(15, 23, 42, 0.04)",
              },
            }}
          >
            {isCalculating ? "Calculating..." : "Calculate Departure Time"}
          </Button>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {recommendation && (
            <Box
              sx={{
                p: 2,
                bgcolor: "rgba(206, 255, 119, 0.1)",
                borderRadius: 2,
                border: "1px solid rgba(206, 255, 119, 0.3)",
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Recommended Departure
                  </Typography>
                  <Typography variant="h4" sx={{ color: "#0f172a", fontWeight: 600 }}>
                    {recommendation.recommendedDepartureTime}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    icon={<TrendingUp />}
                    label={`${recommendation.trafficCondition} traffic`}
                    size="small"
                    color={getTrafficColor(recommendation.trafficCondition) as any}
                    sx={{ textTransform: "capitalize" }}
                  />
                  <Chip
                    icon={<Cloud />}
                    label={recommendation.weatherNote}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    icon={<Schedule />}
                    label={`${recommendation.travelTimeMinutes} min travel + ${recommendation.bufferMinutes} min buffer`}
                    size="small"
                    variant="outlined"
                  />
                  {recommendation.distance && (
                    <Chip
                      icon={<LocationOn />}
                      label={recommendation.distance}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Stack>
            </Box>
          )}

          <TextField
            label="Departure Time"
            type="time"
            value={departTime}
            onChange={(e) => setDepartTime(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="When bus should depart from school"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!dismissTime || !departTime}
          sx={{
            bgcolor: "#0f172a",
            "&:hover": { bgcolor: "#1e293b" },
          }}
        >
          Save Times
        </Button>
      </DialogActions>
    </Dialog>
  );
}
