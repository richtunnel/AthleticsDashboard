"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Delete, CalendarMonth, CheckCircle, Warning, Info, Sync, LinkOff } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

interface CalendarSyncRequest {
  id: string;
  schoolId: string;
  sportName: string;
  sportLevel: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
  rejectionReason?: string;
  requestedAt: string;
  googleCalendarId?: string;
  school: {
    name: string;
  };
}

interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
}

function CalendarSyncPageContent() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [selectedRequestForSync, setSelectedRequestForSync] = useState<CalendarSyncRequest | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["parentCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/parent/calendar-sync-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json() as Promise<{ requests: CalendarSyncRequest[] }>;
    },
  });

  const { data: calendarStatus, isLoading: calendarStatusLoading } = useQuery({
    queryKey: ["parentCalendarStatus"],
    queryFn: async () => {
      const res = await fetch("/api/parent/calendar/status");
      if (!res.ok) return { isConnected: false, connectedEmail: null };
      return res.json() as Promise<{ isConnected: boolean; connectedEmail: string | null }>;
    },
  });

  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ["parentGoogleCalendars"],
    queryFn: async () => {
      // Use the parent-specific endpoint so the AD's Google account tokens
      // (from getAnySession) never bleed into the parent calendar picker.
      const res = await fetch("/api/parent/calendar/list");
      if (!res.ok) return { calendars: [] };
      return res.json() as Promise<{ calendars: GoogleCalendar[] }>;
    },
    enabled: calendarStatus?.isConnected === true,
  });

  const handleConnectCalendar = async () => {
    try {
      const res = await fetch("/api/parent/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/parent-dashboard/calendar-sync" }),
      });
      if (!res.ok) throw new Error("Failed to initiate calendar connection");
      const { authUrl } = await res.json();
      if (authUrl) window.location.href = authUrl;
    } catch (err) {
      addNotification("Failed to start Google Calendar connection", "error");
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/parent/calendar/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect calendar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentCalendarStatus"] });
      queryClient.invalidateQueries({ queryKey: ["parentGoogleCalendars"] });
      addNotification("Google Calendar disconnected", "success");
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/parent/calendar-sync-requests/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentCalendarSyncRequests"] });
      addNotification("Request cancelled", "info");
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ id, googleCalendarId }: { id: string; googleCalendarId: string }) => {
      const res = await fetch(`/api/parent/calendar-sync-requests/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleCalendarId }),
      });
      if (!res.ok) throw new Error("Failed to sync calendar");
      return res.json();
    },
    onSuccess: () => {
      addNotification("Calendar sync started successfully", "success");
      setSyncDialogOpen(false);
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const handleSyncClick = (request: CalendarSyncRequest) => {
    setSelectedRequestForSync(request);
    setSyncDialogOpen(true);
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Calendar Sync
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage your Google Calendar connection and view the status of every sync
        request you&apos;ve submitted. Requests are submitted automatically when
        you add a child — there&apos;s nothing to fill out here.
      </Typography>

      {/* ── Google Calendar connection status ─────────────────────────────── */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Google Calendar
          </Typography>
          {calendarStatusLoading ? (
            <CircularProgress size={20} />
          ) : calendarStatus?.isConnected ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <CheckCircle color="success" fontSize="small" />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Connected
                </Typography>
                {calendarStatus.connectedEmail && (
                  <Typography variant="caption" color="text.secondary">
                    {calendarStatus.connectedEmail}
                  </Typography>
                )}
              </Box>
              <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalendarMonth />}
                  onClick={handleConnectCalendar}
                >
                  Reconnect
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={
                    disconnectMutation.isPending ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <LinkOff />
                    )
                  }
                  disabled={disconnectMutation.isPending}
                  onClick={() => disconnectMutation.mutate()}
                >
                  Disconnect
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Warning color="warning" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Not connected — connect to push game schedules to your Google Calendar.
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<CalendarMonth />}
                onClick={handleConnectCalendar}
                sx={{ ml: "auto" }}
              >
                Connect Google Calendar
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Your Requests
      </Typography>
      {requestsLoading ? (
        <CircularProgress />
      ) : requestsData?.requests.length === 0 ? (
        <Alert severity="info">You haven&apos;t submitted any sync requests yet.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Sport</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requestsData?.requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.school.name}</TableCell>
                  <TableCell>{request.sportName}</TableCell>
                  <TableCell>{request.sportLevel}</TableCell>
                  <TableCell>
                    <Chip
                      label={request.status === "REMOVED" ? "Removed" : request.status}
                      color={
                        request.status === "APPROVED"
                          ? "success"
                          : request.status === "REJECTED"
                          ? "error"
                          : request.status === "REMOVED"
                          ? "default"
                          : "warning"
                      }
                      size="small"
                    />
                    {request.status === "REJECTED" && request.rejectionReason && (
                      <Tooltip title={request.rejectionReason}>
                        <IconButton size="small">
                          <Warning fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {request.status === "PENDING" && (
                      <IconButton
                        color="error"
                        onClick={() => cancelRequestMutation.mutate(request.id)}
                        disabled={cancelRequestMutation.isPending}
                      >
                        <Delete />
                      </IconButton>
                    )}
                    {request.status === "APPROVED" && (
                      <Button
                        variant="outlined"
                        startIcon={<Sync />}
                        size="small"
                        onClick={() => handleSyncClick(request)}
                      >
                        Sync Now
                      </Button>
                    )}
                    {request.status === "REMOVED" && (
                      <Typography variant="caption" color="text.secondary">
                        Removed by AD — use the form above to re-request
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)}>
        <DialogTitle>Sync to Google Calendar</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select which of your Google Calendars you want to sync{" "}
            <strong>{selectedRequestForSync?.sportName} {selectedRequestForSync?.sportLevel}</strong> games to.
          </Typography>

          {calendarStatusLoading || calendarsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !calendarStatus?.isConnected ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You haven&apos;t connected your Google Calendar yet. Connect it to start syncing.
              </Alert>
              <Button
                variant="contained"
                startIcon={<CalendarMonth />}
                onClick={handleConnectCalendar}
              >
                Connect Google Calendar
              </Button>
            </Box>
          ) : calendarsData?.calendars && calendarsData.calendars.length > 0 ? (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Your Calendar</InputLabel>
              <Select
                value={selectedCalendarId}
                label="Your Calendar"
                onChange={(e) => setSelectedCalendarId(e.target.value)}
              >
                {calendarsData.calendars.map((cal) => (
                  <MenuItem key={cal.id} value={cal.id}>
                    {cal.name} {cal.primary && "(Primary)"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Could not load your calendars. Your Google Calendar may need to be reconnected.
              </Alert>
              <Button
                variant="outlined"
                startIcon={<CalendarMonth />}
                onClick={handleConnectCalendar}
              >
                Reconnect Google Calendar
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!selectedCalendarId || !calendarStatus?.isConnected || syncMutation.isPending}
            onClick={() => syncMutation.mutate({ id: selectedRequestForSync!.id, googleCalendarId: selectedCalendarId })}
          >
            {syncMutation.isPending ? <CircularProgress size={24} /> : "Start Sync"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function ParentCalendarSyncPage() {
  return (
    <Suspense fallback={<CircularProgress />}>
      <CalendarSyncPageContent />
    </Suspense>
  );
}
