"use client";

import { useState } from "react";
import {
  Button, Menu, MenuItem, CircularProgress, Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";

interface Workbook {
  id:   string;
  name: string;
}

interface Props {
  requestId:  string;
  workbooks?: Workbook[];   // provided when AD has >1 workbook
  onSynced?:  () => void;
}

export function SyncToScheduleDropdown({ requestId, workbooks, onSynced }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const queryClient         = useQueryClient();
  const { addNotification } = useNotifications();

  const syncMutation = useMutation({
    mutationFn: (workbookId?: string) =>
      fetch(`/api/game-requests/${requestId}/sync`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workbookId }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Sync failed");
        return data;
      }),
    onSuccess: () => {
      addNotification("Game synced to your schedule!", "success");
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      onSynced?.();
    },
    onError: (err: Error) => {
      addNotification(err.message || "Failed to sync game. Please try again.", "error");
    },
  });

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (workbooks && workbooks.length > 1) {
      setAnchor(e.currentTarget);
    } else {
      // Single or no workbook — sync immediately
      syncMutation.mutate(workbooks?.[0]?.id);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={syncMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <SyncIcon fontSize="small" />}
        endIcon={workbooks && workbooks.length > 1 ? <ExpandMoreIcon fontSize="small" /> : undefined}
        onClick={handleClick}
        disabled={syncMutation.isPending || !!syncMutation.data}
        size="small"
        sx={{ textTransform: "none", fontWeight: 600 }}
      >
        {syncMutation.data ? "Synced ✓" : "Sync to Schedule"}
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: "block", color: "text.secondary" }}>
          Select a worksheet
        </Typography>
        {workbooks?.map((wb) => (
          <MenuItem
            key={wb.id}
            onClick={() => {
              setAnchor(null);
              syncMutation.mutate(wb.id);
            }}
          >
            {wb.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
