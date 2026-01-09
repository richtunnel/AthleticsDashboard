"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { Scoreboard } from "@mui/icons-material";

async function fetchScoreTrackerSetting() {
  const res = await fetch("/api/user/score-tracker");
  if (!res.ok) throw new Error("Failed to fetch score tracker setting");
  return res.json();
}

async function updateScoreTrackerSetting(enabled: boolean) {
  const res = await fetch("/api/user/score-tracker", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update score tracker setting");
  return res.json();
}

export function ScoreTrackerToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["scoreTrackerEnabled"],
    queryFn: fetchScoreTrackerSetting,
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await updateScoreTrackerSetting(enabled);
      return { enabled };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scoreTrackerEnabled"] });
      setError(null);
      trackEvent("Score Tracker Toggled", {
        source: "settings_page",
        feature: "score_tracker",
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

  const isEnabled = data?.scoreTrackerEnabled ?? false;

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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box>
              <Typography variant="body1" fontWeight={500}>
                Score Tracker
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Enable score tracking to add game results and view team performance statistics. This adds score entry functionality to teams menu options.
              </Typography>
            </Box>
            <Tooltip
              title="The Score Tracker allows you to enter game scores and view win/loss statistics for your teams. Enable this to access score entry features in the teams menu."
              placement="top"
              arrow
            >
              <IconButton size="small" sx={{ ml: 0.5 }}>
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