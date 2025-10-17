"use client";

import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, CircularProgress } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface QuickAddOpponentProps {
  open: boolean;
  onClose: () => void;
  onCreated: (opponentId: string) => void;
}

export function QuickAddOpponent({ open, onClose, onCreated }: QuickAddOpponentProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [mascot, setMascot] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; mascot?: string }) => {
      const res = await fetch("/api/opponents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create opponent");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opponents"] });
      onCreated(data.data.id);
      setName("");
      setMascot("");
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), mascot: mascot.trim() || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Opponent</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Opponent Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus required />
          {/* <TextField label="Mascot (Optional)" value={mascot} onChange={(e) => setMascot(e.target.value)} fullWidth /> */}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? <CircularProgress size={20} /> : "Add Opponent"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
