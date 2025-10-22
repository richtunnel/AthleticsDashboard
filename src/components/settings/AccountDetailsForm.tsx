"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, Typography, TextField, Button, Stack, CircularProgress, Alert, Snackbar, Avatar, Box } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { updateUserDetails } from "@/app/dashboard/settings/actions";

type OrgOption = { id: string; name: string };

type Props = {
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    organization?: { id: string; name: string } | null | string | null;
    role?: string | null;
    image?: string | null;
  };
};

export default function AccountDetailsForm({ user }: Props) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    role: user.role ?? "",
    image: user.image ?? "",
  });

  const [orgInputValue, setOrgInputValue] = useState<string>(() => {
    if (!user.organization) return "";
    if (typeof user.organization === "string") return user.organization;
    return (user.organization as any).name ?? "";
  });

  const [orgSelected, setOrgSelected] = useState<OrgOption | null>(() => {
    if (!user.organization) return null;
    if (typeof user.organization === "string") return null;
    const org = user.organization as any;
    return org?.id ? { id: org.id, name: org.name } : null;
  });

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ severity: "success" | "error"; message: string } | null>(null);

  // Track initial state for comparison
  const initialData = useMemo(
    () => ({
      name: user.name ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "",
      image: user.image ?? "",
      organization: typeof user.organization === "string" ? user.organization : (user.organization?.name ?? ""),
    }),
    [user]
  );

  // 🔍 Detect if user made changes
  const isDirty = useMemo(() => {
    return (
      form.name.trim() !== initialData.name.trim() ||
      form.phone.trim() !== (initialData.phone ?? "").trim() ||
      form.role.trim() !== (initialData.role ?? "").trim() ||
      form.image.trim() !== (initialData.image ?? "").trim() ||
      orgInputValue.trim() !== (initialData.organization ?? "").trim()
    );
  }, [form, orgInputValue, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!form.name || form.name.trim().length < 2) {
      return "Name must be at least 2 characters";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return; // prevent accidental submit

    const err = validate();
    if (err) {
      setAlert({ severity: "error", message: err });
      return;
    }

    setLoading(true);
    setAlert(null);

    const payload: any = {
      name: form.name.trim(),
      phone: form.phone?.trim() || null,
      role: form.role?.trim() || null,
      image: form.image?.trim() || null,
    };

    if (orgSelected) payload.organizationId = orgSelected.id;
    else if (orgInputValue && orgInputValue.trim() !== "") payload.organizationName = orgInputValue.trim();

    try {
      const res = await updateUserDetails(payload);
      if (res?.success) {
        setAlert({ severity: "success", message: "Profile updated." });
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
    <Card sx={{ border: "none", boxShadow: "none", maxWidth: "720px" }}>
      <CardContent>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
          <Avatar src={form.image || undefined} alt={form.name || ""} />
          <Box>
            <Typography variant="subtitle1">{form.name || "Unnamed"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {form.email}
            </Typography>
          </Box>
        </Box>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField size="small" label="Name" name="name" value={form.name} onChange={handleChange} required fullWidth />
            <TextField size="small" label="Email" name="email" value={form.email} InputProps={{ readOnly: true }} helperText="To change your email, contact support." fullWidth />
            <TextField size="small" label="Phone" name="phone" value={form.phone} onChange={handleChange} fullWidth />
            <TextField size="small" label="Job title / Role" name="role" value={form.role} onChange={handleChange} fullWidth />
            <TextField size="small" label="Profile Image URL" name="image" value={form.image} onChange={handleChange} fullWidth />

            <Autocomplete
              freeSolo
              options={orgOptions}
              getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.name)}
              isOptionEqualToValue={(option, value) => (option as any).id === (value as any).id}
              value={orgSelected ?? (orgInputValue ? { id: "__custom__", name: orgInputValue } : null)}
              onChange={(_, newVal) => {
                if (!newVal) setOrgSelected(null);
                else if (typeof newVal === "string") {
                  setOrgSelected(null);
                  setOrgInputValue(newVal);
                } else if ((newVal as OrgOption).id === "__custom__") {
                  setOrgSelected(null);
                  setOrgInputValue((newVal as OrgOption).name);
                } else {
                  setOrgSelected(newVal as OrgOption);
                  setOrgInputValue((newVal as OrgOption).name);
                }
              }}
              inputValue={orgInputValue}
              onInputChange={(_, val, reason) => {
                if (reason === "input") setOrgInputValue(val);
                if (val === "") setOrgSelected(null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Organization / School"
                  placeholder="Select or type new..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOrgs ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={(option as OrgOption).id}>
                  {(option as OrgOption).name}
                </li>
              )}
            />

            {alert && <Alert severity={alert.severity}>{alert.message}</Alert>}

            <Button type="submit" variant="contained" disabled={!isDirty || loading} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
        </form>

        <Snackbar open={!!alert} autoHideDuration={4000} onClose={() => setAlert(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
      </CardContent>
    </Card>
  );
}
