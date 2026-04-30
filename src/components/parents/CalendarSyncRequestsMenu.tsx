"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Check, Close, CalendarMonth, Info } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

interface CalendarSyncRequest {
  id: string;
  parentUserId: string;
  sportName: string;
  sportLevel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  requestedAt: string;
  parent: {
    name: string | null;
    email: string;
  };
}

interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
}

export function CalendarSyncRequestsMenu() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CalendarSyncRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["adminCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/sync-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json() as Promise<{ requests: CalendarSyncRequest[] }>;
    },
  });

  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ["googleCalendars"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/list-calendars");
      if (!res.ok) throw new Error("Failed to fetch calendars");
      return res.json() as Promise<{ calendars: GoogleCalendar[] }>;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, googleCalendarId }: { id: string; googleCalendarId: string }) => {
      const res = await fetch(`/api/calendar/sync-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleCalendarId }),
      });
      if (!res.ok) throw new Error("Failed to approve request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
      addNotification("Request approved successfully", "success");
      setApproveDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/calendar/sync-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
      addNotification("Request rejected", "info");
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const handleApproveClick = (request: CalendarSyncRequest) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (request: CalendarSyncRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  if (requestsLoading) return <CircularProgress />;

  const pendingRequests = requestsData?.requests.filter(r => r.status === "PENDING") || [];

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Calendar Sync Requests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Approve or reject parent requests to sync team schedules to their Google Calendars.
      </Typography>

      {pendingRequests.length === 0 ? (
        <Alert severity="info">No pending calendar sync requests.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Parent</TableCell>
                <TableCell>Sport</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>Requested At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {request.parent.name || "Unknown Parent"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {request.parent.email}
                    </Typography>
                  </TableCell>
                  <TableCell>{request.sportName}</TableCell>
                  <TableCell>
                    <Chip label={request.sportLevel} size="small" />
                  </TableCell>
                  <TableCell>
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Approve">
                      <IconButton color="success" onClick={() => handleApproveClick(request)}>
                        <Check />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reject">
                      <IconButton color="error" onClick={() => handleRejectClick(request)}>
                        <Close />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)}>
        <DialogTitle>Approve Calendar Sync Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Approve {selectedRequest?.parent.name}&apos;s request to sync {selectedRequest?.sportName} {selectedRequest?.sportLevel} games.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Target Calendar</InputLabel>
            <Select
              value={selectedCalendarId}
              label="Target Calendar"
              onChange={(e) => setSelectedCalendarId(e.target.value)}
            >
              {calendarsData?.calendars.map((cal) => (
                <MenuItem key={cal.id} value={cal.id}>
                  {cal.name} {cal.primary && "(Primary)"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }} icon={<Info />}>
             Select which school calendar this parent should be synced with.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!selectedCalendarId || approveMutation.isPending}
            onClick={() => approveMutation.mutate({ id: selectedRequest!.id, googleCalendarId: selectedCalendarId })}
          >
            {approveMutation.isPending ? <CircularProgress size={24} /> : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject Calendar Sync Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Provide a reason for rejecting {selectedRequest?.parent.name}&apos;s request.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectionReason || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({ id: selectedRequest!.id, reason: rejectionReason })}
          >
            {rejectMutation.isPending ? <CircularProgress size={24} /> : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
