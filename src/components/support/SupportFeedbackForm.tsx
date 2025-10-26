"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";

interface FormData {
  name: string;
  subject: string;
  description: string;
}

interface SupportFeedbackFormProps {
  mode: "support" | "feedback";
  userName?: string;
  ticketNumber?: string;
  initialSubject?: string;
  initialDescription?: string;
  onSuccess?: () => void;
}

export function SupportFeedbackForm({
  mode,
  userName,
  ticketNumber,
  initialSubject = "",
  initialDescription = "",
  onSuccess,
}: SupportFeedbackFormProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      name: userName || "",
      subject: initialSubject,
      description: initialDescription,
    },
  });

  // Update form when props change (for support ticket page)
  useEffect(() => {
    reset({
      name: userName || "",
      subject: initialSubject,
      description: initialDescription,
    });
  }, [userName, initialSubject, initialDescription, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let url: string;
      let method: string;
      let payload: any;

      if (mode === "support" && ticketNumber) {
        // Update existing support ticket
        url = `/api/support/${ticketNumber}`;
        method = "PUT";
        payload = {
          subject: data.subject,
          description: data.description,
        };
      } else if (mode === "support") {
        // Create new support ticket
        url = "/api/support";
        method = "POST";
        payload = {
          subject: data.subject,
          description: data.description,
        };
      } else {
        // Create feedback submission
        url = "/api/feedback";
        method = "POST";
        payload = {
          subject: data.subject,
          message: data.description,
        };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${mode === "support" && ticketNumber ? "update" : "submit"}`);
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (mode === "support" && ticketNumber) {
        setSuccessMessage("Support ticket updated successfully!");
      } else if (mode === "support") {
        setSuccessMessage(`Support ticket created successfully! Ticket number: ${data.data.ticketNumber}`);
      } else {
        setSuccessMessage("Thank you for your feedback!");
        reset({
          name: userName || "",
          subject: "",
          description: "",
        });
      }
      onSuccess?.();
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    setSuccessMessage(null);
    mutation.mutate(data);
  };

  return (
    <Card sx={{ boxShadow: "none", maxWidth: { xs: "100%", md: 800 } }}>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Name Field - Read Only */}
            <TextField
              label="Name"
              {...register("name")}
              fullWidth
              disabled
              InputProps={{
                readOnly: true,
              }}
            />

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
            />

            {/* Description Field */}
            <TextField
              label={mode === "support" ? "Description" : "Message"}
              {...register("description", {
                required: `${mode === "support" ? "Description" : "Message"} is required`,
                minLength: {
                  value: 10,
                  message: `${mode === "support" ? "Description" : "Message"} must be at least 10 characters`,
                },
              })}
              fullWidth
              multiline
              rows={6}
              error={!!errors.description}
              helperText={errors.description?.message}
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
                {mutation.error?.message || `Failed to ${mode === "support" && ticketNumber ? "update" : "submit"}`}
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              disabled={mutation.isPending}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              {mutation.isPending ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  {mode === "support" && ticketNumber ? "Updating..." : "Submitting..."}
                </>
              ) : mode === "support" && ticketNumber ? (
                "Update Ticket"
              ) : mode === "support" ? (
                "Submit Ticket"
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
}
