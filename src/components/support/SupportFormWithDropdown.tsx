"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress, MenuItem, FormControl, InputLabel, Select, FormHelperText } from "@mui/material";

interface FormData {
  issueType: string;
  subject: string;
  message: string;
}

const ISSUE_TYPES = [
  { value: "", label: "Select an issue type" },
  { value: "Technical Support", label: "Technical Support" },
  { value: "Billing", label: "Billing" },
  { value: "Account", label: "Account" },
  { value: "Cancel Subscription", label: "Cancel Subscription" },
  { value: "Troubleshoot", label: "Troubleshoot" },
  { value: "Other", label: "Other" },
];

export function SupportFormWithDropdown() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [issueType, setIssueType] = useState("");
  const [messageLength, setMessageLength] = useState(0);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      issueType: "",
      subject: "",
      message: "",
    },
  });

  const subjectValue = watch("subject");

  // Update message length when message changes
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 500); // Limit to 500 characters
    setValue("message", value);
    setMessageLength(value.length);
  };

  // Update subject when issue type changes
  const handleIssueTypeChange = (value: string) => {
    setIssueType(value);
    setValue("issueType", value);

    // Update subject to include the issue type
    if (value) {
      // If there's already a custom subject, prepend the issue type
      const existingSubject = subjectValue || "";
      const subjectWithoutPreviousType = existingSubject.replace(/^\[.*?\]\s*/, "");
      setValue("subject", `[${value}] ${subjectWithoutPreviousType}`.trim());
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: data.subject,
          description: data.message,
          issueType: data.issueType,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit support request");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(`Support ticket created successfully! Ticket number: ${data.data.ticketNumber}`);
      reset({
        issueType: "",
        subject: "",
        message: "",
      });
      setIssueType("");
      setMessageLength(0);
      
      // Invalidate tickets query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      
      // Scroll to top to show the newly created ticket
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const onSubmit: SubmitHandler<FormData> = (data) => {
    setSuccessMessage(null);
    mutation.mutate(data);
  };

  const isSubmitDisabled = messageLength < 10 || !issueType || mutation.isPending;
  const showMinCharError = messageLength > 0 && messageLength < 10;

  return (
    <Card sx={{ boxShadow: "none", maxWidth: { xs: "100%", md: 800 } }}>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Issue Type Dropdown */}
            <FormControl fullWidth error={!!errors.issueType}>
              <InputLabel
                sx={{
                  top: "-5px",
                }}
                id="issue-type-label"
              >
                Issue Type *
              </InputLabel>
              <Select
                labelId="issue-type-label"
                id="issue-type"
                value={issueType}
                label="Issue Type *"
                {...register("issueType", {
                  required: "Please select an issue type",
                })}
                onChange={(e) => handleIssueTypeChange(e.target.value)}
              >
                {ISSUE_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value} disabled={type.value === ""}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.issueType && <FormHelperText>{errors.issueType.message}</FormHelperText>}
            </FormControl>

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

            {/* Message Field */}
            <Box>
              <TextField
                label="Message"
                {...register("message", {
                  required: "Message is required",
                  minLength: {
                    value: 10,
                    message: "Message must be at least 10 characters",
                  },
                  maxLength: {
                    value: 500,
                    message: "Message cannot exceed 500 characters",
                  },
                })}
                fullWidth
                multiline
                rows={6}
                error={!!errors.message || showMinCharError}
                helperText={errors.message?.message || (showMinCharError ? "Message must be at least 10 characters" : "")}
                onChange={handleMessageChange}
                inputProps={{
                  maxLength: 500,
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 1,
                }}
              >
                <Typography variant="caption" color={showMinCharError ? "error" : "text.secondary"}>
                  {showMinCharError ? `${10 - messageLength} more characters needed` : messageLength >= 10 ? "✓ Minimum length met" : ""}
                </Typography>
                <Typography variant="caption" color={messageLength >= 500 ? "error" : "text.secondary"}>
                  {messageLength} / 500 characters
                </Typography>
              </Box>
            </Box>

            {/* Success Message */}
            {successMessage && (
              <Alert severity="success" onClose={() => setSuccessMessage(null)}>
                {successMessage}
              </Alert>
            )}

            {/* Error Message */}
            {mutation.isError && <Alert severity="error">{mutation.error?.message || "Failed to submit support request"}</Alert>}

            {/* Submit Button */}
            <Button type="submit" variant="contained" disabled={isSubmitDisabled} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>
              {mutation.isPending ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Creating Ticket...
                </>
              ) : (
                "Create Ticket"
              )}
            </Button>

            {isSubmitDisabled && messageLength > 0 && messageLength < 10 && (
              <Typography variant="body2" color="error">
                Please write at least 10 characters in your message before submitting.
              </Typography>
            )}
          </Box>
        </form>
      </CardContent>
    </Card>
  );
}
