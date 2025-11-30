"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

async function fetchAIEmailGenerationSetting() {
  const res = await fetch("/api/user/ai-email-generation");
  if (!res.ok) throw new Error("Failed to fetch AI email generation setting");
  return res.json();
}

async function updateAIEmailGenerationSetting(enabled: boolean) {
  const res = await fetch("/api/user/ai-email-generation", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Failed to update AI email generation setting");
  return res.json();
}

export function AIEmailGenerationToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aiEmailGenerationEnabled"],
    queryFn: fetchAIEmailGenerationSetting,
  });

  const mutation = useMutation({
    mutationFn: updateAIEmailGenerationSetting,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aiEmailGenerationEnabled"] });
      setError(null);
      trackEvent("AI Email Generation Toggled", {
        source: "settings_page",
        feature: "ai_email_generation",
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

  const isEnabled = data?.aiEmailGenerationEnabled ?? false;

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
                AI Email Generation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Automatically generate professional emails for game notifications and communications.
              </Typography>
            </Box>
            <Tooltip
              title="AI Email Generation creates context-aware, professional emails for game notifications, schedule updates, travel information, and more. Choose from multiple tones (formal, casual, friendly) and get HTML-formatted output with improvement suggestions."
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
