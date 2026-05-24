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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import { Check, Close, Info, Refresh } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

interface CalendarSyncRequest {
  id: string;
  parentUserId: string;
  sportName: string;
  sportLevel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  requestedAt: string;
  reviewedAt?: string | null;
  parent: {
    name: string | null;
    email: string;
  };
}

export function CalendarSyncRequestsMenu() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CalendarSyncRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  // Approve-dialog fields
  const [approveGender, setApproveGender] = useState("");
  const [approveSheetUrl, setApproveSheetUrl] = useState("");

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["adminCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/calendar-sync-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json() as Promise<{ requests: CalendarSyncRequest[] }>;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, gender, spreadsheetId }: { id: string; gender?: string; spreadsheetId?: string }) => {
      const res = await fetch(`/api/admin/calendar-sync-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: gender || null,
          spreadsheetId: spreadsheetId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
      addNotification("Request approved — the parent can now sync their calendar", "success");
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setApproveGender("");
      setApproveSheetUrl("");
    },
    onError: (error: Error) => {
      addNotification(error.message, "error");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/admin/calendar-sync-requests/${id}/reject`, {
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
    setApproveGender("");
    setApproveSheetUrl("");
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (request: CalendarSyncRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  if (requestsLoading) return <CircularProgress />;

  const allRequests = requestsData?.requests || [];
  const pendingRequests = allRequests.filter((r) => r.status === "PENDING");

  // A re-sync request is a PENDING request from a parent who previously had a
  // REJECTED request for the same school + sport + level. We detect this by
  // checking if there's any REJECTED entry for the same parentUserId / sport / level.
  const rejectedKeys = new Set(
    allRequests
      .filter((r) => r.status === "REJECTED")
      .map((r) => `${r.parentUserId}|${r.sportName.toLowerCase()}|${r.sportLevel.toLowerCase()}`)
  );

  const isResync = (req: CalendarSyncRequest) =>
    rejectedKeys.has(`${req.parentUserId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`);

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
                <TableCell>Type</TableCell>
                <TableCell>Requested</TableCell>
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
                    {isResync(request) ? (
                      <Chip
                        icon={<Refresh />}
                        label="Re-sync"
                        size="small"
                        color="warning"
                        variant="outlined"
                        title="This parent previously had sync access that was removed"
                      />
                    ) : (
                      <Chip label="New" size="small" color="primary" variant="outlined" />
                    )}
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
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Calendar Sync Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Approve <strong>{selectedRequest?.parent.name || selectedRequest?.parent.email}</strong>&apos;s
            request to sync <strong>{selectedRequest?.sportName} {selectedRequest?.sportLevel}</strong> games to their Google Calendar.
          </Typography>

          {/* Gender — clarifies which team games to sync */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="approve-gender-label">Gender</InputLabel>
            <Select
              labelId="approve-gender-label"
              value={approveGender}
              label="Gender"
              onChange={(e) => setApproveGender(e.target.value)}
              displayEmpty
            >
              <MenuItem value=""><em>Auto-detect from sport name</em></MenuItem>
              <MenuItem value="boys">Boys / Male</MenuItem>
              <MenuItem value="girls">Girls / Female</MenuItem>
              <MenuItem value="mixed">Mixed / Co-ed</MenuItem>
            </Select>
            <FormHelperText>
              Setting this ensures the correct team is matched even when ADs use abbreviations
              like &quot;G Basketball&quot;, &quot;F&quot;, or &quot;Womens Tennis&quot;.
            </FormHelperText>
          </FormControl>

          {/* Schedule spreadsheet — scope the sync to a specific Google Sheet */}
          <TextField
            fullWidth
            label="Schedule Spreadsheet (optional)"
            placeholder="Paste Google Sheets URL or spreadsheet ID"
            value={approveSheetUrl}
            onChange={(e) => setApproveSheetUrl(e.target.value)}
            helperText="If you manage schedules in a specific Google Sheet, paste the link here. This tells the system which spreadsheet to use when matching games for this parent."
            sx={{ mb: 2 }}
          />

          <Alert severity="info" icon={<Info />}>
            Once approved, the parent can sync matching games directly to their own Google Calendar.
            The gender and spreadsheet selections help identify the right games even when your
            schedule uses shorthand like &quot;Var&quot;, &quot;G&quot;, or &quot;B Soccer JV&quot;.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setApproveDialogOpen(false); setApproveGender(""); setApproveSheetUrl(""); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={approveMutation.isPending}
            onClick={() =>
              approveMutation.mutate({
                id: selectedRequest!.id,
                gender: approveGender || undefined,
                spreadsheetId: approveSheetUrl || undefined,
              })
            }
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
