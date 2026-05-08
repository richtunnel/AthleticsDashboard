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
  sportName: string;
  sportLevel: string;
  calendarSynced: boolean;
  lastSyncedAt: string | null;
  membershipStatus: string;
  createdAt: string;
}

type SnackbarState = { open: boolean; message: string; severity: AlertColor };
const DEFAULT_SNACKBAR: SnackbarState = { open: false, message: "", severity: "success" };

async function fetchConnectedParents(): Promise<{ parents: ConnectedParent[] }> {
  const res = await fetch("/api/connected-parents");
  if (!res.ok) throw new Error("Failed to fetch connected parents");
  return res.json();
}

async function syncParent(id: string): Promise<{ message: string }> {
  const res = await fetch(`/api/admin/connected-parents/${id}/sync`, { method: "POST" });
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

  const showMessage = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

  const { data, isLoading, error } = useQuery({
    queryKey: ["connectedParents"],
    queryFn: fetchConnectedParents,
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: syncParent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
      showMessage(data.message || "Calendar synced");
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
            Parents connected to your school. Use the action buttons to sync, unsync, or remove a parent.
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
                        {parent.sportName && (
                          <Chip label={parent.sportName} size="small" variant="outlined" />
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
                      {/* Sync */}
                      <Tooltip title="Re-sync this parent's Google Calendar with upcoming games">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={
                              syncMutation.isPending && syncMutation.variables === parent.id ? (
                                <CircularProgress size={12} />
                              ) : (
                                <Sync sx={{ fontSize: 14 }} />
                              )
                            }
                            disabled={isBusy}
                            onClick={() => syncMutation.mutate(parent.id)}
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
                                unsyncMutation.isPending && unsyncMutation.variables === parent.id ? (
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

      {/* Remove confirmation dialog */}
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
            {removeMutation.isPending ? "Removing..." : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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
