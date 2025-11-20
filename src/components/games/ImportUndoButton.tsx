"use client";

import { useEffect, useState } from "react";
import { Button, Box, Fade } from "@mui/material";
import { Undo } from "@mui/icons-material";
import { useImportUndoStore } from "@/lib/stores/importUndoStore";

interface ImportUndoButtonProps {
  onUndo: () => void;
}

export function ImportUndoButton({ onUndo }: ImportUndoButtonProps) {
  const { showUndoButton, importedGameIds, undoImport, clearUndo, importTimestamp } = useImportUndoStore();
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!showUndoButton || !importTimestamp) return;

    // Start fade out at 25 seconds (5 seconds before auto-hide)
    const fadeTimeout = setTimeout(() => {
      setOpacity(0);
    }, 25000);

    return () => clearTimeout(fadeTimeout);
  }, [showUndoButton, importTimestamp]);

  useEffect(() => {
    // Reset opacity when new import happens
    if (showUndoButton) {
      setOpacity(1);
    }
  }, [showUndoButton, importTimestamp]);

  const handleUndo = () => {
    undoImport();
    onUndo();
  };

  if (!showUndoButton || importedGameIds.length === 0) {
    return null;
  }

  return (
    <Fade in={showUndoButton} timeout={1000}>
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1300,
          opacity: opacity,
          transition: "opacity 5s ease-out",
        }}
      >
        <Button
          variant="contained"
          color="primary"
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
          Undo Import ({importedGameIds.length} games)
        </Button>
      </Box>
    </Fade>
  );
}
