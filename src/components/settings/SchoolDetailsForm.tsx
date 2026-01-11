"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, Typography, TextField, Button, Stack, CircularProgress, Alert } from "@mui/material";
import { updateSchoolDetails } from "@/app/dashboard/settings/actions";
import SchoolAddressAutocomplete from "@/components/forms/SchoolAddressAutocomplete";
import { useTheme } from "@/contexts/ThemeContext";
import { useTheme as customTheme } from "@mui/material/styles";

type Props = {
  user: {
    schoolName?: string | null;
    teamName?: string | null;
    schoolAddress?: string | null;
    schoolEmail?: string | null;
  };
};

export default function SchoolDetailsForm({ user }: Props) {
  const theme = customTheme();
  const { mode } = useTheme();
  const [form, setForm] = useState({
    schoolName: user.schoolName ?? "",
    teamName: user.teamName ?? "",
    schoolAddress: user.schoolAddress ?? "",
    schoolEmail: user.schoolEmail ?? "",
  });

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ severity: "success" | "error"; message: string } | null>(null);

  const initialData = useMemo(
    () => ({
      schoolName: user.schoolName ?? "",
      teamName: user.teamName ?? "",
      schoolAddress: user.schoolAddress ?? "",
      schoolEmail: user.schoolEmail ?? "",
    }),
    [user]
  );

  const isDirty = useMemo(() => {
    return form.schoolName.trim() !== initialData.schoolName.trim() || form.teamName.trim() !== initialData.teamName.trim() || form.schoolAddress.trim() !== initialData.schoolAddress.trim() || form.schoolEmail.trim() !== initialData.schoolEmail.trim();
  }, [form, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!form.schoolName || form.schoolName.trim().length < 2) {
      return "School name must be at least 2 characters";
    }
    if (!form.teamName || form.teamName.trim().length < 2) {
      return "Team name must be at least 2 characters";
    }
    if (!form.schoolAddress || form.schoolAddress.trim().length < 5) {
      return "School address must be at least 5 characters";
    }
    if (form.schoolEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.schoolEmail.trim())) {
      return "Please enter a valid email address";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;

    const err = validate();
    if (err) {
      setAlert({ severity: "error", message: err });
      return;
    }

    setLoading(true);
    setAlert(null);

    const payload = {
      schoolName: form.schoolName.trim(),
      teamName: form.teamName.trim(),
      schoolAddress: form.schoolAddress.trim(),
      schoolEmail: form.schoolEmail.trim(),
    };

    try {
      const res = await updateSchoolDetails(payload);
      if (res?.success) {
        setAlert({ severity: "success", message: "School details updated." });
      } else {
        setAlert({ severity: "error", message: res?.error || "Update failed." });
      }
    } catch (err: any) {
      console.error("Update error:", err);
      setAlert({ severity: "error", message: err?.message || "Unexpected error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ border: "none", boxShadow: "none" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
          School Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          Manage your school information including name, team, and address.
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack sx={{ maxWidth: "768px" }} spacing={2}>
            <TextField size="small" label="School Name" name="schoolName" value={form.schoolName} onChange={handleChange} required fullWidth placeholder="e.g., Lincoln High School" />
            <TextField size="small" label="Mascot" name="teamName" value={form.teamName} onChange={handleChange} required fullWidth placeholder="e.g., Lincoln Lions" />
            <TextField size="small" label="School Email Address" name="schoolEmail" type="email" value={form.schoolEmail} onChange={handleChange} fullWidth placeholder="optional@school.edu" helperText="Optional: Used as reply-to address when sending game schedules" />
            <SchoolAddressAutocomplete
              value={form.schoolAddress}
              onChange={(value) => setForm((s) => ({ ...s, schoolAddress: value }))}
              label="School Address"
              placeholder="Start typing to search for your school address..."
              required
              size="small"
            />
            {alert && <Alert severity={alert.severity}>{alert.message}</Alert>}
            <Button
              sx={{ color: theme.palette.themeButtonText.main }}
              type="submit"
              variant="contained"
              disabled={!isDirty || loading}
              startIcon={loading ? <CircularProgress size={18} /> : undefined}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
