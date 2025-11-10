"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress } from "@mui/material";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

async function fetchAutoSyncSetting() {
  const res = await fetch("/api/user/calendar-auto-sync");
  if (!res.ok) throw new Error("Failed to fetch auto-sync setting");
  return res.json();
}

async function updateAutoSyncSetting(enabled: boolean) {
  const res = await fetch("/api/user/calendar-auto-sync", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update auto-sync setting");
  return res.json();
}

export function AutoCalendarSyncToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["autoCalendarSync"],
    queryFn: fetchAutoSyncSetting,
  });

  const mutation = useMutation({
    mutationFn: updateAutoSyncSetting,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["autoCalendarSync"] });
      setError(null);
      trackEvent("Calendar Auto-Sync Toggled", {
        enabled: variables,
        source: "settings",
      });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    mutation.mutate(event.target.checked);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  const isEnabled = data?.autoCalendarSyncEnabled ?? false;

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={handleToggle}
            disabled={mutation.isPending}
          />
        }
        label={
          <Box>
            <Typography variant="body1" fontWeight={500}>
              Auto-sync new games to calendar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              Automatically sync games to Google Calendar when created or updated. Manual sync will always be available.
            </Typography>
          </Box>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
