"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Box, Button, TextField, MenuItem, Typography, Alert, CircularProgress, LinearProgress, FormControl, InputLabel, Select } from "@mui/material";
import { PersonAdd, PersonRemove } from "@mui/icons-material";
import { formatCollaboratorCount } from "@/lib/utils/collaboration";

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["VIEWER", "MEMBER"], {
    message: "Please select a role",
  }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteCollaboratorFormProps {
  usedSlots: number;
  availableSlots: number;
  collaboratorLimit: number;
  onSuccess?: () => void;
}

export function InviteCollaboratorForm({ usedSlots, availableSlots, collaboratorLimit, onSuccess }: InviteCollaboratorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isAtLimit = usedSlots >= collaboratorLimit;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "VIEWER",
    },
  });

  const watchedEmail = watch("email");
  const isNonGmail = watchedEmail && 
    !watchedEmail.toLowerCase().endsWith("@gmail.com") && 
    !watchedEmail.toLowerCase().endsWith("@googlemail.com");

  const countInfo = formatCollaboratorCount(usedSlots, collaboratorLimit);

  const onSubmit = async (data: InviteFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/collaboration/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to send invitation");
      }

      setSuccess(result.message);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <PersonAdd sx={{ mr: 1, verticalAlign: "middle" }} />
        Invite Collaborators
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Invite team members to collaborate on your dashboard. They&apos;ll get their own access without sharing your login.
      </Typography>

      {/* Slot Usage */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Collaborator Slots
          </Typography>
          <Typography variant="body2" fontWeight="medium" color={countInfo.isAtLimit ? "error.main" : countInfo.isNearLimit ? "warning.main" : "text.secondary"}>
            {countInfo.text}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={countInfo.percentage} color={countInfo.isAtLimit ? "error" : countInfo.isNearLimit ? "warning" : "primary"} sx={{ height: 8, borderRadius: 4 }} />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {isAtLimit ? (
        <Alert severity="info">You&apos;ve reached your collaborator limit ({collaboratorLimit}). Upgrade your plan to invite more team members.</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              {...register("email")}
              label="Email Address"
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={isLoading}
              placeholder="colleague@example.com"
              />

              {isNonGmail && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1, fontStyle: "italic" }}>
              Users have a better experience using a gmail address. Non-gmail users must finish setting up their account manually when invited via email.
              </Typography>
              )}

              <FormControl fullWidth error={!!errors.role}>
              <InputLabel id="role-select-label">Role</InputLabel>
              <Select {...register("role")} labelId="role-select-label" label="Role" defaultValue="VIEWER" disabled={isLoading}>
                <MenuItem value="VIEWER">
                  <Box>
                    <Typography variant="body1">Viewer (Read-Only)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      View dashboard and reports, but cannot make changes
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="MEMBER">
                  <Box>
                    <Typography variant="body1">Member (Full Access)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      View and edit games, teams, and schedules
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || isAtLimit}
              startIcon={isLoading ? <CircularProgress size={20} /> : <PersonAdd />}
              sx={{ width: { sm: "100%", lg: "50%" }, maxWidth: "250px" }}
            >
              {isLoading ? "Sending..." : "Send Invite"}
            </Button>
          </Box>
        </form>
      )}
    </Box>
  );
}
