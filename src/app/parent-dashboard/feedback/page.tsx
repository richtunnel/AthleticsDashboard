"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { Feedback } from "@mui/icons-material";
import TopFooter from "@/components/footer/topFooter";
import { getFirstName } from "@/lib/utils/name";

interface FormData {
  subject: string;
  description: string;
}

export default function ParentFeedbackPage() {
  const { data: session } = useSession();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userName = getFirstName(session?.user?.name) || "Parent";

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: { subject: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/parent/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: data.subject, message: data.description }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit feedback");
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccessMessage("Thank you for your feedback!");
      reset();
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    setSuccessMessage(null);
    mutation.mutate(data);
  };

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 3,
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 130px)",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Feedback color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Share Your Feedback
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        We value your feedback, {userName}! Let us know how we can improve your experience.
      </Typography>

      {/* Form */}
      <Card sx={{ boxShadow: "none", maxWidth: { xs: "100%", md: 700 }, mb: 2 }}>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Name (read-only, pre-filled) */}
              <TextField
                label="Name"
                value={session?.user?.name || ""}
                fullWidth
                disabled
                InputProps={{ readOnly: true }}
              />

              {/* Subject */}
              <TextField
                label="Subject"
                {...register("subject", {
                  required: "Subject is required",
                  minLength: { value: 3, message: "Subject must be at least 3 characters" },
                })}
                fullWidth
                error={!!errors.subject}
                helperText={errors.subject?.message}
              />

              {/* Message */}
              <TextField
                label="Message"
                {...register("description", {
                  required: "Message is required",
                  minLength: { value: 10, message: "Message must be at least 10 characters" },
                })}
                fullWidth
                multiline
                rows={6}
                error={!!errors.description}
                helperText={errors.description?.message}
              />

              {successMessage && (
                <Alert severity="success" onClose={() => setSuccessMessage(null)}>
                  {successMessage}
                </Alert>
              )}

              {mutation.isError && (
                <Alert severity="error">
                  {mutation.error?.message || "Failed to submit feedback"}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={mutation.isPending}
                sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
              >
                {mutation.isPending ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>

      {/* Footer pushed to bottom */}
      <TopFooter />
    </Box>
  );
}
