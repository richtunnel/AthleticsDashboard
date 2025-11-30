"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import Link from "next/link";

async function fetchAITravelTimesSetting() {
  const res = await fetch("/api/user/ai-travel-times");
  if (!res.ok) throw new Error("Failed to fetch AI travel times setting");
  return res.json();
}

async function updateAITravelTimesSetting(enabled: boolean) {
  const res = await fetch("/api/user/ai-travel-times", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update AI travel times setting");
  return res.json();
}

export function AITravelTimesToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aiTravelTimesEnabled"],
    queryFn: fetchAITravelTimesSetting,
  });

  const mutation = useMutation({
    mutationFn: updateAITravelTimesSetting,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aiTravelTimesEnabled"] });
      setError(null);
      trackEvent("AI Travel Times Toggled", {
        source: "settings_page",
        feature: "ai_travel_times",
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

  const isEnabled = data?.aiTravelTimesEnabled ?? false;

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={isEnabled}
            onChange={handleToggle}
            // disabled={mutation.isPending}
            disabled
          />
        }
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box>
              <Typography variant="body1" fontWeight={500}>
                Enhanced Travel Times (Bus Info)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Add a column named "Bus Info" to your spreadsheet in <Link href="/dashboard/games">Game Center</Link> and get real-time travel calculations with traffic and weather for accurate bus
                scheduling.
              </Typography>
            </Box>
            <Tooltip
              title="Enhanced Travel Times integrates with Google Maps and weather services to calculate accurate travel times considering real-time traffic, weather conditions, and safety factors. Perfect for planning bus departures and arrivals."
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
