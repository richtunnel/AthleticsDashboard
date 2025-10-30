"use client";

import { useState, useEffect } from "react";
import { Switch, FormControlLabel, Typography, Stack, Paper } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { toggleAutoFill } from "@/app/dashboard/travel-ai/actions";

interface AutoFillToggleProps {
  initialValue: boolean;
}

export function AutoFillToggle({ initialValue }: AutoFillToggleProps) {
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedValue, setLastSavedValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsEnabled(initialValue);
    setLastSavedValue(initialValue);
  }, [initialValue]);

  const handleToggle = async (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    const previousValue = isEnabled;
    setIsEnabled(checked);
    setIsSaving(true);
    setError(null);

    try {
      const response = await toggleAutoFill(checked);
      if (!response.success) {
        throw new Error(response.error || "Failed to toggle auto-fill");
      }

      setLastSavedValue(checked);
      queryClient.setQueryData(["travel-settings"], (prev: any) => {
        if (!prev || typeof prev !== "object") {
          return prev;
        }

        return {
          ...prev,
          data: {
            ...(prev.data ?? {}),
            autoFillEnabled: checked,
          },
        };
      });
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
      setIsEnabled(previousValue);
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
        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}
        {!error && (
          <Typography variant="body2" color={isSaving ? "text.primary" : "text.secondary"}>
            {isSaving ? "Saving preference..." : lastSavedValue ? "Recommendations will auto-populate for new games." : "You can still generate recommendations manually."}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
