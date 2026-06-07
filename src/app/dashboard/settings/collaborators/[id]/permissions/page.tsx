"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  CalendarMonth,
  ChatBubbleOutline,
  CheckCircle,
  Group,
  Lock,
  ManageAccounts,
  Message,
  Newspaper,
  Person,
  SaveOutlined,
  SportsScore,
} from "@mui/icons-material";
import Link from "next/link";
import { CollaboratorPermissions, parsePermissions } from "@/types/collaboration";

// ── Permission definitions ────────────────────────────────────────────────────

interface PermissionDef {
  key: keyof CollaboratorPermissions;
  label: string;
  description: string;
  icon: React.ReactNode;
  locked?: boolean; // always on, cannot be toggled
}

const PERMISSION_DEFS: PermissionDef[] = [
  {
    key: "gameCenter",
    label: "Game Center",
    description: "View and manage the game schedule, import CSVs, create and edit games.",
    icon: <SportsScore fontSize="small" />,
    locked: true,
  },
  {
    key: "scheduleBoard",
    label: "Schedule Exchange Board",
    description: "Browse open dates posted by other ADs and request games.",
    icon: <Group fontSize="small" />,
  },
  {
    key: "emailManager",
    label: "Email Manager",
    description: "Access email groups, campaigns, and send schedule emails.",
    icon: <Message fontSize="small" />,
  },
  {
    key: "calendarSync",
    label: "Calendar Sync",
    description: "View and manage Google Calendar sync settings.",
    icon: <CalendarMonth fontSize="small" />,
  },
  {
    key: "adChat",
    label: "AD Chat",
    description: "Access the AD-to-AD messaging system (Chat page).",
    icon: <ChatBubbleOutline fontSize="small" />,
  },
  {
    key: "parentMessages",
    label: "Parent Messages",
    description: "View parent athlete messages and connection requests in the Connect section.",
    icon: <Person fontSize="small" />,
  },
  {
    key: "connect",
    label: "Connect — Parent Management",
    description: "Manage parent connections, approve sync requests, and view parent details.",
    icon: <ManageAccounts fontSize="small" />,
  },
  {
    key: "community",
    label: "Community",
    description: "View and post in the community feed, send announcements.",
    icon: <Newspaper fontSize="small" />,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Access account settings. Enable only for trusted collaborators.",
    icon: <Lock fontSize="small" />,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface CollaboratorInfo {
  email: string;
  role: string;
  status: string;
  permissions: CollaboratorPermissions;
}

export default function CollaboratorPermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<CollaboratorInfo | null>(null);
  const [permissions, setPermissions] = useState<CollaboratorPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load current permissions
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/collaboration/members/${id}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setInfo(data);
        setPermissions(parsePermissions(data.permissions));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const toggle = (key: keyof CollaboratorPermissions) => {
    if (!permissions) return;
    setPermissions((prev) => prev ? { ...prev, [key]: !prev[key] } : prev);
  };

  const handleSave = async () => {
    if (!permissions) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/collaboration/members/${id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setPermissions(parsePermissions(data.permissions));
      setSavedAt(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !info) {
    return (
      <Box sx={{ maxWidth: 700, mx: "auto", py: 4 }}>
        <Button component={Link} href="/dashboard/settings" startIcon={<ArrowBack />} sx={{ mb: 2, textTransform: "none" }}>
          Back to Settings
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const enabledCount = permissions
    ? Object.entries(permissions).filter(([k, v]) => k !== "gameCenter" && v === true).length
    : 0;

  return (
    <Box sx={{ maxWidth: 740, mx: "auto", py: { xs: 2, sm: 3 }, px: { xs: 1, sm: 0 } }}>

      {/* Back button */}
      <Button
        component={Link}
        href="/dashboard/settings"
        startIcon={<ArrowBack />}
        size="small"
        sx={{ mb: 2, textTransform: "none", color: "text.secondary" }}
      >
        Back to Settings
      </Button>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Collaborator Permissions
        </Typography>
        {info && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {info.email}
            </Typography>
            <Chip label={info.role} size="small" variant="outlined" color="primary" />
            <Chip
              label={info.status}
              size="small"
              color={info.status === "ACCEPTED" ? "success" : "default"}
              variant="outlined"
            />
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          All features are <strong>off by default</strong>. Enable only what this collaborator needs.
          Changes take effect immediately on their next page load.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Permission cards */}
      <Stack spacing={1.5}>
        {PERMISSION_DEFS.map((def) => {
          const isOn = permissions?.[def.key] ?? false;
          return (
            <Card
              key={def.key}
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: isOn && !def.locked ? "primary.main" : "divider",
                borderRadius: 2,
                transition: "border-color 0.2s",
                opacity: def.locked ? 0.8 : 1,
              }}
            >
              <CardContent sx={{ py: 1.75, px: 2.5, "&:last-child": { pb: 1.75 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        mt: 0.25,
                        color: isOn || def.locked ? "primary.main" : "text.disabled",
                        flexShrink: 0,
                        transition: "color 0.2s",
                      }}
                    >
                      {def.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="body2" fontWeight={600}>
                          {def.label}
                        </Typography>
                        {def.locked && (
                          <Chip label="Always on" size="small" color="success" sx={{ height: 18, fontSize: "0.65rem" }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, display: "block" }}>
                        {def.description}
                      </Typography>
                    </Box>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={isOn}
                        onChange={() => !def.locked && toggle(def.key)}
                        disabled={def.locked}
                        color="primary"
                        size="small"
                      />
                    }
                    label=""
                    sx={{ m: 0, flexShrink: 0 }}
                  />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Save bar */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {enabledCount} optional {enabledCount === 1 ? "permission" : "permissions"} enabled
          </Typography>
          {savedAt && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
              <CheckCircle sx={{ fontSize: 14, color: "success.main" }} />
              <Typography variant="caption" color="success.main">
                Saved {savedAt.toLocaleTimeString()}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => router.push("/dashboard/settings")}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
            sx={{ textTransform: "none", minWidth: 120 }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
