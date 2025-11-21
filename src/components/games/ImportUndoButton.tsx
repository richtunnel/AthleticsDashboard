"use client";

import { useEffect, useState } from "react";
import { Button, Box, Fade } from "@mui/material";
import { Undo } from "@mui/icons-material";
import { useImportUndoStore } from "@/lib/stores/importUndoStore";

interface ImportUndoButtonProps {
  onUndo: () => void;
}

export function ImportUndoButton({ onUndo }: ImportUndoButtonProps) {
  const { importedGameIds, importTimestamp, undoImport } = useImportUndoStore();
  const [fadeOut, setFadeOut] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

  const isVisible = importedGameIds.length > 0;

  // Update time remaining countdown
  useEffect(() => {
    if (!isVisible || !importTimestamp) {
      setTimeRemaining(30);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - importTimestamp;
      const remaining = Math.max(0, Math.ceil((30000 - elapsed) / 1000));
      setTimeRemaining(remaining);

      // Start fade out at 5 seconds remaining
      if (remaining <= 5 && !fadeOut) {
        setFadeOut(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isVisible, importTimestamp, fadeOut]);

  // Reset fade out when new import happens
  useEffect(() => {
    if (isVisible) {
      setFadeOut(false);
    }
  }, [isVisible, importTimestamp]);

  const handleUndo = async () => {
    await undoImport();
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
          right: 24,
          zIndex: 1300,
        }}
      >
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={<Undo />}
          onClick={handleUndo}
          sx={{
            boxShadow: 3,
            "&:hover": {
              boxShadow: 6,
            },
          }}
        >
          Undo Import ({importedGameIds.length} games) - {timeRemaining}s
        </Button>
      </Box>
    </Fade>
  );
}
