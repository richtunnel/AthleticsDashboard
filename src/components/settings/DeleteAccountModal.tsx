"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Close, WarningAmber } from "@mui/icons-material";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export default function DeleteAccountModal({
  open,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const isConfirmValid = confirmText.toLowerCase() === "delete";

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText("");
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (isConfirmValid) {
      await onConfirm();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningAmber color="error" />
            <Typography variant="h6">Delete Account</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isDeleting}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            This action cannot be undone!
          </Typography>
          <Typography variant="body2">
            Deleting your account will permanently remove all your data, including:
          </Typography>
        </Alert>

        <Box sx={{ mb: 3, pl: 2 }}>
          <Typography variant="body2" component="ul" sx={{ m: 0 }}>
            <li>All games and schedules</li>
            <li>Teams, venues, and opponents</li>
            <li>Email groups and campaigns</li>
            <li>Calendar sync connections</li>
            <li>Subscription and billing history</li>
            <li>All other account data</li>
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          To confirm deletion, please type <strong>delete</strong> in the field below:
        </Typography>

        <TextField
          fullWidth
          label="Confirmation"
          placeholder="Type 'delete' to confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={isDeleting}
          autoFocus
          error={confirmText !== "" && !isConfirmValid}
          helperText={
            confirmText !== "" && !isConfirmValid
              ? "Please type 'delete' to confirm"
              : ""
          }
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={!isConfirmValid || isDeleting}
          startIcon={isDeleting ? <CircularProgress size={20} /> : null}
        >
          {isDeleting ? "Deleting..." : "Delete Account"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
