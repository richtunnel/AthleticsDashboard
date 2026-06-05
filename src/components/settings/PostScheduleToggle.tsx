"use client";

import { FormControlLabel, Switch, Typography } from "@mui/material";
import { useDashboardPreferencesStore } from "@/lib/stores/dashboardPreferencesStore";

export function PostScheduleToggle() {
  const { showPostScheduleButton, setShowPostScheduleButton } = useDashboardPreferencesStore();

  return (
    <FormControlLabel
      control={
        <Switch
          checked={showPostScheduleButton}
          onChange={(e) => setShowPostScheduleButton(e.target.checked)}
          color="primary"
        />
      }
      label={
        <Typography variant="body2">
          Show <strong>Post Schedule</strong> quick-link button in Game Center
        </Typography>
      }
    />
  );
}
