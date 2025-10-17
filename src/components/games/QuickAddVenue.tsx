"use client";

import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, CircularProgress } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface QuickAddVenueProps {
  open: boolean;
  onClose: () => void;
  onCreated: (venueId: string) => void;
}

export function QuickAddVenue({ open, onClose, onCreated }: QuickAddVenueProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create venue");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      onCreated(data.data.id);
      setName("");
      setAddress("");
      setCity("");
      setState("");
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Venue</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Venue Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus required />
          <TextField label="Address (Optional)" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label="City (Optional)" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
            <TextField label="State (Optional)" value={state} onChange={(e) => setState(e.target.value)} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? <CircularProgress size={20} /> : "Add Venue"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
