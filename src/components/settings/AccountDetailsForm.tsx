"use client";

import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, Typography, TextField, Button, Stack, CircularProgress, Alert, Snackbar, Avatar, Box, Chip, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { Google, Email, CameraAlt } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import { updateUserDetails } from "@/app/dashboard/settings/actions";
import { ALLOWED_SETTINGS_ROLES, ROLE_OPTIONS, AllowedSettingsRole } from "@/lib/constants/role";
import { getFirstName } from "@/lib/utils/name";
import { useTheme } from "@/contexts/ThemeContext";
import { useTheme as customTheme } from "@mui/material/styles";
import { useSession } from "next-auth/react";

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
  /** Email address of the connected Google Calendar account (may differ from login email) */
  googleCalendarEmail?: string | null;
  /** School / institution email entered during onboarding */
  schoolEmail?: string | null;
};

export default function AccountDetailsForm({ user, googleCalendarEmail, schoolEmail }: Props) {
  const theme = customTheme();
  const { mode } = useTheme();
  const { update: updateSession } = useSession();

  const [form, setForm] = useState({
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    role: (user.role ?? "") as AllowedSettingsRole | "",
  });

  const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const isRoleLocked = ["SUPER_ADMIN", "ATHLETIC_DIRECTOR"].includes(user.role || "");

  // Track initial state for comparison
  const initialData = useMemo(
    () => ({
      name: user.name ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "",
      organization: typeof user.organization === "string" ? user.organization : (user.organization?.name ?? ""),
    }),
    [user]
  );

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAvatarError(null);
    setPreviewFile(file);
    setPreviewSrc(URL.createObjectURL(file));
  };

  const handlePreviewCancel = () => {
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
    setPreviewFile(null);
  };

  const handleAvatarConfirm = async () => {
    if (!previewFile) return;
    const file = previewFile;
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(null);
    setPreviewFile(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Upload failed");
      setAvatarUrl(json.data.url);
      await updateSession();
    } catch (err: any) {
      setAvatarError(err.message || "Failed to upload photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  //  Detect if user made changes
  const isDirty = useMemo(() => {
    return (
      form.name.trim() !== initialData.name.trim() ||
      form.phone.trim() !== (initialData.phone ?? "").trim() ||
      form.role.trim() !== (initialData.role ?? "").trim() ||
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
    if (form.role && !Object.values(ALLOWED_SETTINGS_ROLES).includes(form.role as AllowedSettingsRole)) {
      return "Invalid role selected. Choose from: Super Admin, Athletic Director, Assistant AD, Coach, Staff, Vendor (Read Only)";
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
    };

    // Only include role in payload if the role field is visible and changed
    if (!isRoleLocked && form.role) {
      payload.role = form.role.trim();
    }

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
    <Card sx={{ border: "none", boxShadow: "none" }}>
      <CardContent>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
          <Tooltip title="Change profile photo">
            <Box
              sx={{ position: "relative", width: 64, height: 64, cursor: "pointer", flexShrink: 0 }}
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              role="button"
              aria-label="Change profile photo"
            >
              <Avatar
                src={avatarUrl || undefined}
                alt={form.name || "Profile photo"}
                sx={{ width: 64, height: 64, bgcolor: "primary.main", color: "#fff", fontSize: "1.5rem" }}
              >
                {(getFirstName(form.name) || "U")[0].toUpperCase()}
              </Avatar>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  bgcolor: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: avatarUploading ? 1 : 0,
                  transition: "opacity 0.18s",
                  "&:hover": { opacity: 1 },
                }}
              >
                {avatarUploading
                  ? <CircularProgress size={24} sx={{ color: "#fff" }} />
                  : <CameraAlt sx={{ color: "#fff", fontSize: 22 }} />}
              </Box>
            </Box>
          </Tooltip>
          <Box>
            <Typography variant="subtitle1">{getFirstName(form.name) || "Unnamed"}</Typography>
            <Typography variant="body2" color="text.secondary">{form.email}</Typography>
            <Typography variant="caption" color="text.disabled">Click photo to change</Typography>
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
            aria-hidden="true"
          />
        </Box>
        {avatarError && (
          <Alert severity="error" onClose={() => setAvatarError(null)} sx={{ mb: 2, maxWidth: 768 }}>
            {avatarError}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack sx={{ maxWidth: "768px" }} spacing={2}>
            <TextField size="small" label="Name" name="name" value={form.name} onChange={handleChange} required fullWidth />
            <TextField
              size="small"
              label="Google Sign-in Email"
              name="email"
              value={form.email}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <Box component="span" sx={{ display: "flex", alignItems: "center", mr: 1, color: "text.secondary" }}>
                    <Google fontSize="small" />
                  </Box>
                ),
              }}
              helperText="Your Google account used to sign in. To change, contact support."
              fullWidth
            />

            {/* Google Calendar connected email — only shown when present and different from sign-in email */}
            {googleCalendarEmail && googleCalendarEmail !== form.email && (
              <TextField
                size="small"
                label="Google Calendar Email"
                value={googleCalendarEmail}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <Box component="span" sx={{ display: "flex", alignItems: "center", mr: 1, color: "text.secondary" }}>
                      <Google fontSize="small" />
                    </Box>
                  ),
                }}
                helperText="The Google account connected to Calendar Sync. Manage this in the Calendar Sync page."
                fullWidth
              />
            )}

            {/* Always show Calendar email when connected (even if same as sign-in) */}
            {googleCalendarEmail && googleCalendarEmail === form.email && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  icon={<Google />}
                  label="Google Calendar connected"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: "0.75rem" }}
                />
                <Typography variant="caption" color="text.secondary">
                  Same account as sign-in
                </Typography>
              </Box>
            )}

            {/* School email */}
            <TextField
              size="small"
              label="School Email"
              value={schoolEmail ?? ""}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <Box component="span" sx={{ display: "flex", alignItems: "center", mr: 1, color: "text.secondary" }}>
                    <Email fontSize="small" />
                  </Box>
                ),
              }}
              helperText={
                schoolEmail
                  ? "Your school / institution email. Edit this in the School Details section below."
                  : "No school email set. Add one in the School Details section below."
              }
              fullWidth
            />
            <TextField size="small" label="Phone" name="phone" value={form.phone} onChange={handleChange} fullWidth />
            {/* <Autocomplete
              size="small"
              options={ROLE_OPTIONS}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              value={ROLE_OPTIONS.find((opt) => opt.value === form.role) || null}
              onChange={(_, newValue) => {
                setForm((s: any) => ({ ...s, role: newValue ? newValue.value : null }));
              }}
              renderInput={(params) => <TextField {...params} label="Job title / Role" />}
              renderOption={(props, option) => (
                <li {...props} key={option.value}>
                  {option.label}
                </li>
              )}
              disabled={isRoleLocked}
            />
            {isRoleLocked && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Your role ({user.role}) cannot be changed from this page. Contact support for assistance.
              </Typography>
            )} */}
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
              renderOption={(props, option) => {
                const { key, ...optionProps } = props as React.HTMLAttributes<HTMLLIElement> & {
                  key: React.Key;
                };

                return (
                  <li key={key} {...optionProps}>
                    {(option as OrgOption).name}
                  </li>
                );
              }}
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

        <Snackbar open={!!alert} autoHideDuration={4000} onClose={() => setAlert(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />

        {/* Photo preview modal */}
        <Dialog open={Boolean(previewSrc)} onClose={handlePreviewCancel} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>Preview photo</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pb: 1 }}>
            {previewSrc && (
              <Box
                component="img"
                src={previewSrc}
                alt="Photo preview"
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid",
                  borderColor: "primary.main",
                }}
              />
            )}
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Does this look good? Click &ldquo;Update photo&rdquo; to save.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button onClick={handlePreviewCancel} color="inherit" size="small">
              Cancel
            </Button>
            <Button onClick={handleAvatarConfirm} variant="contained" size="small">
              Update photo
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
