"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Button, TextField, Box, Typography, Alert, CircularProgress, InputAdornment } from "@mui/material";
import { Close, School, Person, Email } from "@mui/icons-material";
import Link from "next/link";
import { CircularProjectIcon } from "@/components/circle-logo/OpleticsLogo";
import TopFooter from "@/components/footer/topFooter";

interface PartnerFormData {
  fullName: string;
  email: string;
  schoolOrCollege: string;
}

interface PartnerFormModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PartnerFormModal({ open, onClose }: PartnerFormModalProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PartnerFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      schoolOrCollege: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PartnerFormData) => {
      const res = await fetch("/api/partners/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit partnership request");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || "Thank you for your interest! Our team will contact you shortly.");
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

  const onSubmit: SubmitHandler<PartnerFormData> = (data) => {
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
    <div
      data-theme="dark"
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#131316",
        color: "rgb(197, 197, 210)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: open ? "flex" : "none",
      }}
    >
      <header className="flex items-center justify-between px-5 pt-5">
        <Link href="/">
          <CircularProjectIcon color="#fff" size={40} />
        </Link>
        <button
          onClick={handleClose}
          className="text-sm font-medium"
          style={{ color: "rgb(197, 197, 210)", textDecoration: "none", background: "none", border: "none", cursor: "pointer" }}
          disabled={mutation.isPending}
        >
          <Close sx={{ color: "rgb(197, 197, 210)" }} />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 3 }}>
              <Typography variant="h3" className="text-5xl font-semibold tracking-tight">
                Partner with Opletics
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ color: "rgb(197, 197, 210)", fontSize: "1.1rem" }}>
              Join the Opletics network to unlock access to our comprehensive ecosystem of athletic management tools and integrations.
            </Typography>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center gap-4">
            <TextField
              label="Full Name"
              variant="outlined"
              slotProps={{
                inputLabel: {
                  sx: {
                    color: "rgb(209, 209, 221)",
                  },
                },
              }}
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
              className="w-full rounded-xl text-base outline-none"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: "#fff" }} fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(197, 197, 210, 0.04)",
                  "& fieldset": {
                    borderColor: errors.fullName ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&:hover fieldset": {
                    borderColor: errors.fullName ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: errors.fullName ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                },
                "& .MuiInputBase-input": {
                  color: "rgb(197, 197, 210)",
                },
                "& .MuiInputLabel-root": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiFormHelperText-root": {
                  color: errors.fullName ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                },
              }}
            />

            <TextField
              label="Email Address"
              variant="outlined"
              slotProps={{
                inputLabel: {
                  sx: {
                    color: "rgb(209, 209, 221)",
                  },
                },
              }}
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
              className="w-full rounded-xl text-base outline-none"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: "#fff" }} fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(197, 197, 210, 0.04)",
                  "& fieldset": {
                    borderColor: errors.email ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&:hover fieldset": {
                    borderColor: errors.email ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: errors.email ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                },
                "& .MuiInputBase-input": {
                  color: "rgb(197, 197, 210)",
                },
                "& .MuiInputLabel-root": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiFormHelperText-root": {
                  color: errors.email ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                },
              }}
            />

            <TextField
              label="School or College"
              variant="outlined"
              slotProps={{
                inputLabel: {
                  sx: {
                    color: "rgb(209, 209, 221)",
                  },
                },
              }}
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
              className="w-full rounded-xl text-base outline-none"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <School sx={{ color: "#fff" }} fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(197, 197, 210, 0.04)",
                  "& fieldset": {
                    borderColor: errors.schoolOrCollege ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&:hover fieldset": {
                    borderColor: errors.schoolOrCollege ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: errors.schoolOrCollege ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                  },
                },
                "& .MuiInputBase-input": {
                  color: "rgb(197, 197, 210)",
                },
                "& .MuiInputLabel-root": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "rgb(209, 209, 221)",
                },
                "& .MuiFormHelperText-root": {
                  color: errors.schoolOrCollege ? "rgb(244, 67, 54)" : "rgb(197, 197, 210)",
                },
              }}
            />

            {/* Success Message */}
            {successMessage && (
              <Alert
                severity="success"
                onClose={() => setSuccessMessage(null)}
                sx={{
                  width: "100%",
                  border: "1px solid rgb(197, 197, 210)",
                  backgroundColor: "rgba(197, 197, 210, 0.06)",
                  color: "rgb(197, 197, 210)",
                  "& .MuiAlert-icon": {
                    color: "rgb(197, 197, 210)",
                  },
                }}
              >
                {successMessage}
              </Alert>
            )}

            {/* Error Message */}
            {mutation.isError && (
              <Alert
                severity="error"
                sx={{
                  width: "100%",
                  border: "1px solid rgb(197, 197, 210)",
                  backgroundColor: "rgba(197, 197, 210, 0.06)",
                  color: "rgb(197, 197, 210)",
                  "& .MuiAlert-icon": {
                    color: "rgb(197, 197, 210)",
                  },
                }}
              >
                {mutation.error?.message || "Failed to submit partnership request. Please try again."}
              </Alert>
            )}

            <div className="w-full flex gap-4">
              <Button
                onClick={handleClose}
                color="inherit"
                disabled={mutation.isPending}
                className="flex-1 rounded-xl font-semibold transition-opacity"
                sx={{
                  border: `1px solid rgb(197, 197, 210)`,
                  padding: "14px 22px",
                  opacity: mutation.isPending ? 0.55 : 1,
                  color: "rgb(197, 197, 210)",
                  backgroundColor: "transparent",
                  "&:hover": {
                    backgroundColor: "rgba(197, 197, 210, 0.1)",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={mutation.isPending}
                startIcon={mutation.isPending ? <CircularProgress size={20} color="inherit" /> : null}
                className="flex-1 rounded-xl font-semibold transition-opacity"
                sx={{
                  border: `1px solid rgb(197, 197, 210)`,
                  padding: "14px 22px",
                  opacity: mutation.isPending ? 0.55 : 1,
                  backgroundColor: "rgb(197, 197, 210)",
                  color: "#131316",
                  "&:hover": {
                    backgroundColor: "rgba(197, 197, 210, 0.9)",
                  },
                }}
              >
                {mutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgb(197, 197, 210)" }}>
        <TopFooter />
      </div>
    </div>
  );
}
