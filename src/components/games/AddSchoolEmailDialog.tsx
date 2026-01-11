"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
} from "@mui/material";
import { LoadingButton } from "../utils/LoadingButton";

interface AddSchoolEmailDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
}

export function AddSchoolEmailDialog({ open, onClose, onConfirm }: AddSchoolEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!email.trim()) {
      setError("Please enter an email address or choose to continue without one");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      await onConfirm(email.trim());
      setEmail("");
    } catch (err: any) {
      setError(err.message || "Failed to save email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setEmail("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add School Email Address</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          You don't have a school email address set up. Adding one allows recipients to reply directly to your school email when you send game schedules.
        </DialogContentText>
        
        <DialogContentText sx={{ mb: 2, fontWeight: "medium" }}>
          Would you like to add your school email address now?
        </DialogContentText>

        <TextField
          autoFocus
          fullWidth
          label="School Email Address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="your.email@school.edu"
          helperText="This will be used as the reply-to address for emails you send"
          disabled={loading}
          sx={{ mb: 1 }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <DialogContentText variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          You can also skip this step and add your school email later in Settings → Account Details.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleSkip} disabled={loading}>
          Skip for now
        </Button>
        <LoadingButton
          onClick={handleConfirm}
          loading={loading}
          variant="contained"
        >
          Save & Continue
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}