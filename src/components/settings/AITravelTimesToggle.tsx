"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import Link from "next/link";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";

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
  // Anchor for the first-login "arrival time only" tip.
  const [rowAnchor, setRowAnchor] = useState<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aiTravelTimesEnabled"],
    queryFn: fetchAITravelTimesSetting,
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // First update the setting
      await updateAITravelTimesSetting(enabled);
      
      // If enabling, create the "Travel Time" custom column
      if (enabled) {
        try {
          const checkRes = await fetch("/api/organizations/custom-columns");
          const checkData = await checkRes.json();
          const existingColumn = checkData.data?.find(
            (col: any) => col.name.toLowerCase() === "travel time"
          );
          
          if (!existingColumn) {
            await fetch("/api/organizations/custom-columns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "Travel Time", type: "TEXT" }),
            });
          }
        } catch (error) {
          console.error("Failed to create Travel Time column:", error);
          // Don't fail the toggle if column creation fails
        }
      }
      
      return { enabled };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aiTravelTimesEnabled"] });
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
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
    <Box ref={setRowAnchor}>
      <TipBubble
        tipId={TIP_IDS.AI_TRAVEL_TIMES}
        anchorEl={rowAnchor}
        placement="top-start"
        title="Just enter the arrival time"
        body="No need to calculate departure times yourself. Enter when your team needs to arrive and Opletics figures out exactly when the bus should leave — accounting for live traffic and weather."
      />
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
                Enhanced Travel Times (Bus Info)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Enabling travel intillegence adds a column named "Bus Info" to your spreadsheet in <Link href="/dashboard/games" style={{ color: "var(--main-blue)", fontWeight: "500" }}>Game Center</Link> which gives you real-time travel calculations with
                traffic and weather for accurate bus scheduling.
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
