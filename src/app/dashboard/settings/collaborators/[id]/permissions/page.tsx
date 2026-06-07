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
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  CalendarMonth,
  ChatBubbleOutline,
  CheckCircle,
  Group,
  InfoOutlined,
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
  tooltip: string;
  icon: React.ReactNode;
  locked?: boolean;
}

const PERMISSION_DEFS: PermissionDef[] = [
  {
    key: "gameCenter",
    label: "Game Center",
    description: "View and manage the game schedule, import CSVs, create and edit games.",
    tooltip: "Game Center is always accessible to all collaborators and cannot be disabled.",
    icon: <SportsScore fontSize="small" />,
    locked: true,
  },
  {
    key: "scheduleBoard",
    label: "Schedule Exchange Board",
    description: "Browse open dates posted by other ADs and request games from the Exchange Board.",
    tooltip: "When enabled, the collaborator can view and interact with the Schedule Exchange Board.",
    icon: <Group fontSize="small" />,
  },
  {
    key: "emailManager",
    label: "Email Manager",
    description: "Access email groups and campaigns, and send schedule emails on your behalf.",
    tooltip: "When enabled, the collaborator can manage contact groups and send email campaigns.",
    icon: <Message fontSize="small" />,
  },
  {
    key: "calendarSync",
    label: "Calendar Sync",
    description: "View and manage Google Calendar sync settings and connected calendars.",
    tooltip: "When enabled, the collaborator can access the Calendars page and manage sync settings.",
    icon: <CalendarMonth fontSize="small" />,
  },
  {
    key: "adChat",
    label: "AD Chat",
    description: "Access the AD-to-AD messaging system and read or send chat messages.",
    tooltip: "When enabled, the collaborator can read and reply to messages on the Chat page.",
    icon: <ChatBubbleOutline fontSize="small" />,
  },
  {
    key: "parentMessages",
    label: "Parent Messages",
    description: "View parent athlete messages and connection requests in the Connect section.",
    tooltip: "Enable only for collaborators who assist with parent communications.",
    icon: <Person fontSize="small" />,
  },
  {
    key: "connect",
    label: "Connect — Parent Management",
    description: "Manage parent connections, approve calendar sync requests, and view parent details.",
    tooltip: "When enabled, the collaborator can approve or remove parent connections.",
    icon: <ManageAccounts fontSize="small" />,
  },
  {
    key: "community",
    label: "Community",
    description: "View and post in the community feed and send announcements to parents.",
    tooltip: "When enabled, the collaborator can post updates and send announcements.",
    icon: <Newspaper fontSize="small" />,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Access account settings including school details and billing. Enable only for trusted collaborators.",
    tooltip: "When enabled, the collaborator can view and edit account settings.",
    icon: <Lock fontSize="small" />,
  },
];

// ── Single toggle row (matches MenuVisibilityToggles style) ───────────────────

function PermissionToggle({
  def,
  checked,
  disabled,
  onChange,
}: {
  def: PermissionDef;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexGrow: 1 }}>
        <Box sx={{ color: "text.secondary", mt: 0.25 }}>{def.icon}</Box>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="body1" fontWeight={500}>
              {def.label}
            </Typography>
            {def.locked && (
              <Chip label="Always on" size="small" color="success" sx={{ height: 18, fontSize: "0.62rem", ml: 0.5 }} />
            )}
            <Tooltip title={def.tooltip} placement="top" arrow>
              <IconButton size="small">
                <InfoOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
            {def.description}
          </Typography>
        </Box>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            color="primary"
          />
        }
        label=""
        sx={{ mr: 0 }}
      />
    </Box>
  );
}

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
    setPermissions((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
    setSavedAt(null);
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !info) {
    return (
      <Box sx={{ maxWidth: 740, mx: "auto", py: 4 }}>
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

      <Button
        component={Link}
        href="/dashboard/settings"
        startIcon={<ArrowBack />}
        size="small"
        sx={{ mb: 2.5, textTransform: "none", color: "text.secondary" }}
      >
        Back to Settings
      </Button>

      {/* Header card — matches Others page section style */}
      <Card sx={{ mb: 3, boxShadow: "none !important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Collaborator Permissions
          </Typography>
          {info && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">{info.email}</Typography>
              <Chip label={info.role} size="small" variant="outlined" color="primary" />
              <Chip label={info.status} size="small" color={info.status === "ACCEPTED" ? "success" : "default"} variant="outlined" />
            </Stack>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            All features are <strong>off by default</strong>. Enable only what this collaborator needs.
            Changes take effect immediately on their next page load.
          </Typography>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Single card with all toggles — matches MenuVisibilityToggles / Others page */}
      <Card sx={{ mb: 3, boxShadow: "none !important" }}>
        <CardContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {PERMISSION_DEFS.map((def, idx) => (
              <Box key={def.key}>
                {idx > 0 && <Divider sx={{ mb: 2.5 }} />}
                <PermissionToggle
                  def={def}
                  checked={permissions?.[def.key] ?? false}
                  disabled={def.locked ?? false}
                  onChange={(v) => toggle(def.key)}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

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
          <Button variant="outlined" size="small" onClick={() => router.push("/dashboard/settings")} sx={{ textTransform: "none" }}>
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
