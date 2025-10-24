"use client";

import { useState, useEffect } from "react";
import { Switch, FormControlLabel, Typography, Stack, Paper, Button } from "@mui/material";
import { LoadingButton } from "../utils/LoadingButton";
import { toggleAutoFill } from "@/app/dashboard/travel-ai/actions";

interface AutoFillToggleProps {
  initialValue: boolean;
}

export function AutoFillToggle({ initialValue }: AutoFillToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedValue, setLastSavedValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsEnabled(initialValue);
    setLastSavedValue(initialValue);
  }, [initialValue]);

  const handleToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setIsEnabled(checked);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await toggleAutoFill(isEnabled);
      if (!response.success) {
        throw new Error(response.error || "Failed to toggle auto-fill");
      }
      setLastSavedValue(isEnabled);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
      setIsEnabled(lastSavedValue);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Auto-fill Bus Travel Info</Typography>
        <Typography variant="body2" color="text.secondary">
          When enabled, new games with travel requirements will automatically receive AI-generated bus departure and arrival times based on real-time traffic and weather data.
        </Typography>
        <FormControlLabel control={<Switch checked={isEnabled} onChange={handleToggle} disabled={isSaving} />} label={isEnabled ? "Auto-fill enabled" : "Auto-fill disabled"} />
        <Stack direction="row" spacing={2} alignItems="center">
          <LoadingButton loading={isSaving} variant="contained" onClick={handleSave}>
            Save Preference
          </LoadingButton>
          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {lastSavedValue ? "Recommendations will auto-populate for new games." : "You can still generate recommendations manually."}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
