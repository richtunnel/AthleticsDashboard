"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

async function fetchAISchedulerSetting() {
  const res = await fetch("/api/user/ai-scheduler");
  if (!res.ok) throw new Error("Failed to fetch AI scheduler setting");
  return res.json();
}

async function updateAISchedulerSetting(enabled: boolean) {
  const res = await fetch("/api/user/ai-scheduler", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update AI scheduler setting");
  return res.json();
}

export function AISchedulerToggle({ disabled }: { disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aiSchedulerEnabled"],
    queryFn: fetchAISchedulerSetting,
  });

  const mutation = useMutation({
    mutationFn: updateAISchedulerSetting,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aiSchedulerEnabled"] });
      setError(null);
      trackEvent("AI Scheduler Toggled", {
        source: "settings_page",
        feature: "ai_scheduler",
        enabled: variables,
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

  const isEnabled = data?.aiSchedulerEnabled ?? false;

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={handleToggle}
            // disabled={mutation.isPending || disabled}
            disabled
          />
        }
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box>
              <Typography variant="body1" fontWeight={500}>
                AI-Powered Scheduler (Coming Soon)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Get intelligent scheduling suggestions and conflict detection for your games.
              </Typography>
            </Box>
            <Tooltip
              title="AI Scheduler scans your calendar and suggests optimal dates/times for games, considering team availability, venue conflicts, and rest periods. It also detects scheduling conflicts and provides confidence scores with alternatives."
              placement="top"
              arrow
            >
              <IconButton size="small" sx={{ ml: 0.5 }} disabled={disabled}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
