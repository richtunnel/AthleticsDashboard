"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
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
import { Close, HelpOutline } from "@mui/icons-material";

interface FormData {
  subject: string;
  description: string;
}

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
}

export default function SupportModal({ open, onClose, userName }: SupportModalProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      subject: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: data.subject,
          description: data.description,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit support ticket");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(`Support ticket created successfully! Ticket number: ${data.data.ticketNumber}`);
      reset({
        subject: "",
        description: "",
      });
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    setSuccessMessage(null);
    mutation.mutate(data);
  };

  const handleClose = () => {
    if (!mutation.isPending) {
      reset();
      setSuccessMessage(null);
      mutation.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HelpOutline color="primary" />
            <Typography variant="h6">Get Help</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={mutation.isPending}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Need assistance? Submit a support ticket and our team will get back to you as soon as possible.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Subject Field */}
            <TextField
              label="Subject"
              {...register("subject", {
                required: "Subject is required",
                minLength: {
                  value: 3,
                  message: "Subject must be at least 3 characters",
                },
              })}
              fullWidth
              error={!!errors.subject}
              helperText={errors.subject?.message}
              disabled={mutation.isPending}
            />

            {/* Description Field */}
            <TextField
              label="Description"
              {...register("description", {
                required: "Description is required",
                minLength: {
                  value: 10,
                  message: "Description must be at least 10 characters",
                },
              })}
              fullWidth
              multiline
              rows={6}
              error={!!errors.description}
              helperText={errors.description?.message}
              disabled={mutation.isPending}
            />

            {/* Success Message */}
            {successMessage && (
              <Alert severity="success" onClose={() => setSuccessMessage(null)}>
                {successMessage}
              </Alert>
            )}

            {/* Error Message */}
            {mutation.isError && (
              <Alert severity="error">
                {mutation.error?.message || "Failed to submit support ticket"}
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={20} /> : null}
          >
            {mutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
