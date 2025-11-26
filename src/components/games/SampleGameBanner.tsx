"use client";

import { useState } from "react";
import { Alert, Button, Box, Typography } from "@mui/material";
import { Delete, Info } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";

interface SampleGameBannerProps {
  hasSampleGames: boolean;
}

export function SampleGameBanner({ hasSampleGames }: SampleGameBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const deleteSampleGamesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/games/sample", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete sample games");
      }

      return response.json();
    },
    onSuccess: (data) => {
      addNotification(data.data.message || "Sample game deleted successfully", "success");
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setDismissed(true);
    },
    onError: (error) => {
      addNotification(
        `Failed to delete sample games: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    },
  });

  if (!hasSampleGames || dismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      icon={<Info />}
      sx={{
        mb: 2,
        borderRadius: 2,
        "& .MuiAlert-message": {
          width: "100%",
        },
      }}
      action={
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            color="inherit"
            size="small"
            startIcon={<Delete />}
            onClick={() => deleteSampleGamesMutation.mutate()}
            disabled={deleteSampleGamesMutation.isPending}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {deleteSampleGamesMutation.isPending ? "Deleting..." : "Delete Sample"}
          </Button>
          <Button
            color="inherit"
            size="small"
            onClick={() => setDismissed(true)}
            sx={{
              textTransform: "none",
            }}
          >
            Dismiss
          </Button>
        </Box>
      }
    >
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        Sample game detected
      </Typography>
      <Typography variant="caption" sx={{ mt: 0.5, display: "block", opacity: 0.9 }}>
        This is a sample game created when you signed up. You can delete it when you&apos;re ready to add your own games, or it will be automatically removed when you import your schedule.
      </Typography>
    </Alert>
  );
}
