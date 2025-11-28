"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Alert,
} from "@mui/material";
import { RestartAlt } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

export function ResetColumnsButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/reset-columns", {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to reset columns");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate table preferences to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] });
      
      addNotification(
        data.message || "Custom columns reset successfully. Default columns restored.",
        "success"
      );
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      addNotification(
        error.message || "Failed to reset columns. Please try again.",
        "error"
      );
    },
  });

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!resetMutation.isPending) {
      setDialogOpen(false);
    }
  };

  const handleConfirmReset = () => {
    resetMutation.mutate();
  };

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        startIcon={<RestartAlt />}
        onClick={handleOpenDialog}
        sx={{
          textTransform: "none",
          borderRadius: 2,
        }}
      >
        Reset to Default Columns
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset to Default Columns?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will remove your imported custom columns and restore the default spreadsheet columns.
          </DialogContentText>
          <Alert severity="info" sx={{ mb: 0 }}>
            Your game data will not be affected. Only the column layout will be reset to defaults.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={resetMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmReset}
            variant="contained"
            color="primary"
            disabled={resetMutation.isPending}
            startIcon={resetMutation.isPending ? <CircularProgress size={16} /> : <RestartAlt />}
            sx={{ textTransform: "none" }}
          >
            {resetMutation.isPending ? "Resetting..." : "Reset Columns"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
