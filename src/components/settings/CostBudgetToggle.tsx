"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton, Divider } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { AttachMoney } from "@mui/icons-material";

async function fetchCostBudgetSetting() {
  const res = await fetch("/api/user/cost-budget");
  if (!res.ok) throw new Error("Failed to fetch cost budget setting");
  return res.json();
}

async function updateCostBudgetSetting(enabled: boolean, monthlyBudget?: number | null) {
  const body = monthlyBudget !== undefined ? { enabled, monthlyBudget } : { enabled };
  const res = await fetch("/api/user/cost-budget", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update cost budget setting");
  return res.json();
}

export function CostBudgetToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["costBudgetEnabled"],
    queryFn: fetchCostBudgetSetting,
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // First update the setting
      await updateCostBudgetSetting(enabled);

      // If enabling, create the "Cost" custom column
      if (enabled) {
        try {
          const checkRes = await fetch("/api/organizations/custom-columns");
          const checkData = await checkRes.json();
          const existingColumn = checkData.data?.find(
            (col: any) => col.name.toLowerCase() === "cost"
          );

          if (!existingColumn) {
            await fetch("/api/organizations/custom-columns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "Cost", type: "TEXT" }),
            });
          }
        } catch (error) {
          console.error("Failed to create Cost column:", error);
          // Don't fail the toggle if column creation fails
        }
      }

      return { enabled };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["costBudgetEnabled"] });
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setError(null);
      trackEvent("Cost Budget Toggled", {
        source: "settings_page",
        feature: "cost_budget",
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

  const isEnabled = data?.costBudgetEnabled ?? false;

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
                Cost & Budget Calculator
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Enable cost tracking to add a &quot;Cost&quot; column to your spreadsheet. Track expenses per game and manage your monthly budget with real-time calculations.
              </Typography>
            </Box>
            <Tooltip
              title="The Cost & Budget Calculator allows you to enter costs for individual games and set a monthly budget. Track your spending throughout the month and see how much of your budget remains."
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
