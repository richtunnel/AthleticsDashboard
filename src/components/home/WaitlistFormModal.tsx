"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, IconButton, Alert, CircularProgress, InputAdornment } from "@mui/material";
import { Close, School, Person, Email } from "@mui/icons-material";

interface WaitlistFormData {
  fullName: string;
  email: string;
  schoolOrCollege: string;
}

interface WaitlistFormModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WaitlistFormModal({ open, onClose }: WaitlistFormModalProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WaitlistFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      schoolOrCollege: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WaitlistFormData) => {
      const res = await fetch("/api/parents/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to join waitlist");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || "You've been added to the waitlist! We'll notify you when the Parent Portal is available.");
      reset({
        fullName: "",
        email: "",
        schoolOrCollege: "",
      });
      setTimeout(() => {
        handleClose();
      }, 3000);
    },
  });

  const onSubmit: SubmitHandler<WaitlistFormData> = (data) => {
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          height: { xs: "100%", sm: "auto" },
          maxHeight: { xs: "100%", sm: "none" },
          width: { xs: "100%", sm: "90%" },
          margin: { xs: 0, sm: "auto" },
          borderRadius: { xs: 0, sm: 2 },
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* <School color="primary" /> */}
            <Typography variant="h6">Parent Portal Waitlist</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={mutation.isPending}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <form style={{ padding: "0px 24px 20px 24px" }} onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Be the first to access your child&apos;s complete athletic schedule—anytime, anywhere, on any device.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Full Name Field */}
            <TextField
              label="Full Name"
              {...register("fullName", {
                required: "Full name is required",
                minLength: {
                  value: 2,
                  message: "Name must be at least 2 characters",
                },
              })}
              fullWidth
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
              disabled={mutation.isPending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {/* Email Field */}
            <TextField
              label="Email Address"
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={mutation.isPending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {/* School or College Field */}
            <TextField
              label="School or College"
              {...register("schoolOrCollege", {
                required: "School or college name is required",
                minLength: {
                  value: 2,
                  message: "School name must be at least 2 characters",
                },
              })}
              fullWidth
              error={!!errors.schoolOrCollege}
              helperText={errors.schoolOrCollege?.message}
              disabled={mutation.isPending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <School color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {/* Success Message */}
            {successMessage && (
              <Alert severity="success" onClose={() => setSuccessMessage(null)}>
                {successMessage}
              </Alert>
            )}

            {/* Error Message */}
            {mutation.isError && <Alert severity="error">{mutation.error?.message || "Failed to join waitlist. Please try again."}</Alert>}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending} startIcon={mutation.isPending ? <CircularProgress size={20} color="inherit" /> : null}>
            {mutation.isPending ? "Submitting..." : "Join Waitlist"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
