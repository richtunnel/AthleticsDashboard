"use client";

import { useEffect, useState } from "react";
import { Button, Box, Fade, Typography } from "@mui/material";
import { Undo } from "@mui/icons-material";
import { useDeleteUndoStore } from "@/lib/stores/deleteUndoStore";

interface DeleteUndoButtonProps {
  onUndo: () => void;
}

export function DeleteUndoButton({ onUndo }: DeleteUndoButtonProps) {
  const {
    deletedColumns,
    deletedRows,
    columnDeleteTimestamp,
    rowDeleteTimestamp,
    undoColumnDelete,
    undoRowDelete,
  } = useDeleteUndoStore();

  const [fadeOut, setFadeOut] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

  // Determine which type of deletion is active
  const hasColumnDelete = deletedColumns.length > 0;
  const hasRowDelete = deletedRows.length > 0;
  const isVisible = hasColumnDelete || hasRowDelete;

  // Determine which timestamp to use (most recent)
  const activeTimestamp = hasColumnDelete && hasRowDelete
    ? Math.max(columnDeleteTimestamp || 0, rowDeleteTimestamp || 0)
    : hasColumnDelete
    ? columnDeleteTimestamp
    : rowDeleteTimestamp;

  // Update time remaining countdown
  useEffect(() => {
    if (!isVisible || !activeTimestamp) {
      setTimeRemaining(30);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - activeTimestamp;
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
  }, [isVisible, activeTimestamp, fadeOut]);

  // Reset fade out when new deletion happens
  useEffect(() => {
    if (isVisible) {
      setFadeOut(false);
    }
  }, [isVisible, activeTimestamp]);

  const handleUndo = async () => {
    try {
      // Undo the most recent deletion (or both if they exist)
      if (hasColumnDelete) {
        await undoColumnDelete();
      }
      if (hasRowDelete) {
        await undoRowDelete();
      }
      onUndo();
    } catch (error) {
      console.error("Failed to undo deletion:", error);
    }
  };

  if (!isVisible) {
    return null;
  }

  // Determine button text based on what was deleted
  let buttonText = "Undo delete";
  let count = 0;
  
  if (hasColumnDelete && hasRowDelete) {
    buttonText = `Undo deletes`;
  } else if (hasColumnDelete) {
    count = deletedColumns.length;
    buttonText = count === 1 ? "Undo column delete" : `Undo ${count} columns delete`;
  } else if (hasRowDelete) {
    count = deletedRows.length;
    buttonText = count === 1 ? "Undo row delete" : `Undo ${count} rows delete`;
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
          size="large"
          startIcon={<Undo />}
          onClick={handleUndo}
          sx={{
            backgroundColor: "#181b38ff",
            color: "white",
            boxShadow: 3,
            "&:hover": {
              backgroundColor: "#252948",
              boxShadow: 6,
            },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.5,
            py: 1.5,
            px: 3,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {buttonText}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {timeRemaining}s
          </Typography>
        </Button>
      </Box>
    </Fade>
  );
}
