"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Tooltip,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import { Person, Sync, SyncDisabled, Delete, CalendarMonth } from "@mui/icons-material";

interface ConnectedParent {
  id: string;
  parentUserId: string;
  parentUserName: string | null;
  parentEmail: string;
  schoolName: string;
  sportName: string | null;
  sportLevel: string | null;
  calendarSynced: boolean;
  lastSyncedAt: string | null;
  membershipStatus: string;
  createdAt: string;
}

interface Team {
  id: string;
  sportName: string;
  level: string;
}

type SnackbarState = { open: boolean; message: string; severity: AlertColor };
const DEFAULT_SNACKBAR: SnackbarState = { open: false, message: "", severity: "success" };

async function fetchConnectedParents(): Promise<{ parents: ConnectedParent[] }> {
  const res = await fetch("/api/connected-parents");
  if (!res.ok) throw new Error("Failed to fetch connected parents");
  return res.json();
}

async function fetchTeams(): Promise<{ teams: Team[] }> {
  const res = await fetch("/api/teams");
  if (!res.ok) return { teams: [] };
  const json = await res.json();
  // /api/teams returns { success, data: [...] } with sport.name nested
  const raw: any[] = json.data ?? json.teams ?? [];
  return {
    teams: raw.map((t: any) => ({
      id: t.id,
      sportName: t.sport?.name ?? t.sportName ?? "",
      level: t.level ?? "",
    })),
  };
}

async function syncParent(payload: {
  id: string;
  sportName?: string;
  sportLevel?: string;
}): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/connected-parents/${payload.id}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sportName: payload.sportName,
      sportLevel: payload.sportLevel,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to sync");
  return data;
}

async function unsyncParent(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/connected-parents/${id}/unsync`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to unsync");
  return data;
}

async function removeParent(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/connected-parents/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to remove");
  return data;
}

function getMembershipColor(status: string): "success" | "warning" | "error" | "default" {
  switch (status) {
    case "ACTIVE":
    case "TRIALING":
      return "success";
    case "PAST_DUE":
      return "warning";
    case "CANCELED":
    case "UNPAID":
      return "error";
    default:
      return "default";
  }
}

export function ConnectedParentsMenu() {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);
  const [removeTarget, setRemoveTarget] = useState<ConnectedParent | null>(null);
  const [syncTarget, setSyncTarget] = useState<ConnectedParent | null>(null);
  const [syncSport, setSyncSport] = useState("");
  const [syncLevel, setSyncLevel] = useState("");

  const showMessage = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

  const { data, isLoading, error } = useQuery({
    queryKey: ["connectedParents"],
    queryFn: fetchConnectedParents,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamsData } = useQuery({
    queryKey: ["adTeamsForSync"],
    queryFn: fetchTeams,
    staleTime: 10 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: syncParent,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
      showMessage(res.message || "Calendar synced successfully");
      setSyncTarget(null);
      setSyncSport("");
      setSyncLevel("");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const unsyncMutation = useMutation({
    mutationFn: unsyncParent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
      showMessage("Calendar sync removed");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const removeMutation = useMutation({
    mutationFn: removeParent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
      setRemoveTarget(null);
      showMessage("Parent connection removed");
    },
    onError: (err: Error) => {
      showMessage(err.message, "error");
      setRemoveTarget(null);
    },
  });

  const handleSyncClick = (parent: ConnectedParent) => {
    setSyncTarget(parent);
    // Pre-fill from stored sport/level if available
    setSyncSport(parent.sportName ?? "");
    setSyncLevel(parent.sportLevel ?? "");
  };

  const handleSyncConfirm = () => {
    if (!syncTarget) return;
    syncMutation.mutate({
      id: syncTarget.id,
      sportName: syncSport || undefined,
      sportLevel: syncLevel || undefined,
    });
  };

  // Derive unique sport names and levels from teams
  const teams = teamsData?.teams ?? [];
  const uniqueSports = [...new Set(teams.map((t) => t.sportName))].filter(Boolean).sort();
  const levelsForSport = syncSport
    ? [...new Set(teams.filter((t) => t.sportName === syncSport).map((t) => t.level))].filter(Boolean).sort()
    : [];

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load connected parents</Alert>;
  }

  const parents = data?.parents || [];
  const isBusy = syncMutation.isPending || unsyncMutation.isPending || removeMutation.isPending;

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Person color="primary" />
            <Typography variant="h6">Manage parent calendar connections</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Parents connected to your school. Use Sync to push your game schedule
            to a parent&apos;s Google Calendar.
          </Typography>

          {parents.length === 0 ? (
            <Alert severity="info">
              No parents have connected to your school yet. Share the parent portal link to get started!
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {parents.map((parent) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={parent.id}>
                  <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <CardContent sx={{ flex: 1, pb: 1 }}>
                      {/* Parent identity */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, fontSize: 15, bgcolor: "primary.main" }}>
                          {(parent.parentUserName || parent.parentEmail).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={600} noWrap>
                            {parent.parentUserName || "Unknown"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {parent.parentEmail}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ mb: 1.5 }} />

                      {/* Sport & Level */}
                      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1 }}>
                        {parent.sportName ? (
                          <Chip label={parent.sportName} size="small" variant="outlined" />
                        ) : (
                          <Chip label="No sport set" size="small" variant="outlined" color="warning" />
                        )}
                        {parent.sportLevel && (
                          <Chip label={parent.sportLevel} size="small" variant="outlined" color="primary" />
                        )}
                      </Box>

                      {/* School */}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                        {parent.schoolName}
                      </Typography>

                      {/* Calendar status */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                        <CalendarMonth sx={{ fontSize: 14, color: parent.calendarSynced ? "success.main" : "text.disabled" }} />
                        {parent.calendarSynced ? (
                          <Tooltip
                            title={
                              parent.lastSyncedAt
                                ? `Last synced: ${new Date(parent.lastSyncedAt).toLocaleString()}`
                                : "Synced"
                            }
                          >
                            <Chip label="Synced" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                          </Tooltip>
                        ) : (
                          <Chip label="Not Synced" size="small" color="default" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                        )}
                      </Box>

                      {/* Membership status */}
                      <Chip
                        label={parent.membershipStatus}
                        size="small"
                        color={getMembershipColor(parent.membershipStatus)}
                        sx={{ height: 18, fontSize: "0.65rem" }}
                      />
                    </CardContent>

                    <CardActions sx={{ pt: 0, px: 1.5, pb: 1.5, gap: 0.5 }}>
                      {/* Sync — opens sport/level dialog */}
                      <Tooltip title="Sync this parent's Google Calendar with your game schedule">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<Sync sx={{ fontSize: 14 }} />}
                            disabled={isBusy}
                            onClick={() => handleSyncClick(parent)}
                            sx={{ fontSize: "0.7rem", py: 0.4, px: 1 }}
                          >
                            Sync
                          </Button>
                        </span>
                      </Tooltip>

                      {/* Unsync — only show when currently synced */}
                      {parent.calendarSynced && (
                        <Tooltip title="Disable calendar sync for this parent">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={
                                unsyncMutation.isPending && (unsyncMutation.variables as string) === parent.id ? (
                                  <CircularProgress size={12} />
                                ) : (
                                  <SyncDisabled sx={{ fontSize: 14 }} />
                                )
                              }
                              disabled={isBusy}
                              onClick={() => unsyncMutation.mutate(parent.id)}
                              sx={{ fontSize: "0.7rem", py: 0.4, px: 1 }}
                            >
                              Unsync
                            </Button>
                          </span>
                        </Tooltip>
                      )}

                      {/* Remove */}
                      <Tooltip title="Remove this parent connection entirely">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<Delete sx={{ fontSize: 14 }} />}
                            disabled={isBusy}
                            onClick={() => setRemoveTarget(parent)}
                            sx={{ fontSize: "0.7rem", py: 0.4, px: 1, ml: "auto" }}
                          >
                            Remove
                          </Button>
                        </span>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* ── Sync dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(syncTarget)}
        onClose={() => !syncMutation.isPending && setSyncTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Sync Calendar for {syncTarget?.parentUserName || syncTarget?.parentEmail}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the sport and level to sync to this parent&apos;s Google Calendar.
            All matching games from your schedule will be pushed to their calendar.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Sport</InputLabel>
            <Select
              value={syncSport}
              label="Sport"
              onChange={(e) => {
                setSyncSport(e.target.value);
                setSyncLevel("");
              }}
            >
              {uniqueSports.map((sport) => (
                <MenuItem key={sport} value={sport}>
                  {sport}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={!syncSport}>
            <InputLabel>Level</InputLabel>
            <Select
              value={syncLevel}
              label="Level"
              onChange={(e) => setSyncLevel(e.target.value)}
            >
              {levelsForSport.map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            The parent must have connected their Google Calendar in their parent portal for the sync to work.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncTarget(null)} disabled={syncMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!syncSport || !syncLevel || syncMutation.isPending}
            startIcon={syncMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Sync fontSize="small" />}
            onClick={handleSyncConfirm}
          >
            {syncMutation.isPending ? "Syncing…" : "Sync Calendar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove confirmation dialog ──────────────────────────────── */}
      <Dialog open={Boolean(removeTarget)} onClose={() => !removeMutation.isPending && setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove Parent Connection?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove{" "}
            <strong>{removeTarget?.parentUserName || removeTarget?.parentEmail}</strong> from your
            connected parents list and delete all related calendar sync records. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)} disabled={removeMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={removeMutation.isPending}
            startIcon={removeMutation.isPending ? <CircularProgress size={14} /> : undefined}
            onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
          >
            {removeMutation.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
