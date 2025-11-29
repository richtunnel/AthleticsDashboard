"use client";

import { useEffect, useState } from "react";
import { Button, Box, Fade } from "@mui/material";
import { Restore } from "@mui/icons-material";
import { useDeleteUndoStore } from "@/lib/stores/deleteUndoStore";

interface UndoDeleteButtonProps {
  onUndo: () => void;
}

export function UndoDeleteButton({ onUndo }: UndoDeleteButtonProps) {
  const { deletedGames, deleteTimestamp, undoDelete } = useDeleteUndoStore();
  const [fadeOut, setFadeOut] = useState(false);

  const isVisible = deletedGames.length > 0;

  // Update time remaining countdown
  useEffect(() => {
    if (!isVisible || !deleteTimestamp) {
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - deleteTimestamp;
      const remaining = Math.max(0, Math.ceil((30000 - elapsed) / 1000));

      // Start fade out at 5 seconds remaining
      if (remaining <= 5 && !fadeOut) {
        setFadeOut(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isVisible, deleteTimestamp, fadeOut]);

  // Reset fade out when new delete happens
  useEffect(() => {
    if (isVisible) {
      setFadeOut(false);
    }
  }, [isVisible, deleteTimestamp]);

  const handleUndo = async () => {
    await undoDelete();
    onUndo();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Fade in={!fadeOut} timeout={1000}>
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          left: 24,
          zIndex: 1300,
        }}
      >
        <Button
          variant="contained"
          size="large"
          startIcon={<Restore />}
          onClick={handleUndo}
          sx={{
            backgroundColor: "#d32f2f",
            color: "white",
            boxShadow: 3,
            "&:hover": {
              backgroundColor: "#b71c1c",
              boxShadow: 6,
            },
          }}
        >
          Undo delete
        </Button>
      </Box>
    </Fade>
  );
}
