"use client";

import { useState, useRef } from "react";
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
import { Check, CheckCircle, Close, Info, Refresh, DoneAll } from "@mui/icons-material";
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

// ── Approve-All result tracking ───────────────────────────────────────────────
interface ApproveAllResult {
  succeeded: string[]; // request IDs that approved successfully
  failed: Array<{ id: string; parentName: string; sport: string; level: string }>;
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
  const [approveWorkbookId, setApproveWorkbookId] = useState("");

  // Success-transition state (single approve)
  const [approveSucceeded, setApproveSucceeded] = useState(false);
  const [approveFadingOut, setApproveFadingOut] = useState(false);
  const approveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Approve-All state ──────────────────────────────────────────────────────
  const [approveAllDialogOpen, setApproveAllDialogOpen] = useState(false);
  const [approveAllGender, setApproveAllGender] = useState("");
  const [approveAllWorkbookId, setApproveAllWorkbookId] = useState("");
  // Running count while the bulk approve is in flight
  const [approveAllProgress, setApproveAllProgress] = useState<{ done: number; total: number } | null>(null);
  // Final result — null until the run finishes
  const [approveAllResult, setApproveAllResult] = useState<ApproveAllResult | null>(null);

  const closeApproveAllDialog = () => {
    setApproveAllDialogOpen(false);
    setApproveAllGender("");
    setApproveAllWorkbookId("");
    setApproveAllProgress(null);
    setApproveAllResult(null);
  };

  const closeApproveDialog = () => {
    approveTimers.current.forEach(clearTimeout);
    approveTimers.current = [];
    setApproveDialogOpen(false);
    setApproveSucceeded(false);
    setApproveFadingOut(false);
    setSelectedRequest(null);
    setApproveGender("");
    setApproveWorkbookId("");
  };

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["adminCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/calendar-sync-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json() as Promise<{ requests: CalendarSyncRequest[] }>;
    },
  });

  // AD's imported Game Center workbooks — populates the picker so they
  // never have to copy/paste Google Sheets URLs.
  //
  // NOTE: distinct query key from GamesTable's `["gamesWorkbooks"]` cache,
  // which stores the full envelope `{ data: [...] }`. Sharing the key would
  // let either component overwrite the other's shape and crash the consumer.
  //
  // We fetch eagerly (no `enabled` gate) so the dropdown is fully populated
  // the moment the dialog opens — no race condition where the user clicks
  // the Select before workbooks land.
  const { data: workbooksData, isLoading: workbooksLoading } = useQuery({
    queryKey: ["gamesWorkbooks", "sync-picker"],
    queryFn: async () => {
      const res = await fetch("/api/games-workbooks");
      if (!res.ok) throw new Error("Failed to fetch workbooks");
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json?.data;
      return (Array.isArray(arr) ? arr : []) as Array<{
        id: string;
        name: string;
        _count?: { games: number };
      }>;
    },
    staleTime: 30_000, // cache for 30s — these don't change often
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, gender, workbookId }: { id: string; gender?: string; workbookId?: string }) => {
      const res = await fetch(`/api/admin/calendar-sync-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: gender || null,
          workbookId: workbookId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to approve request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
      // Connected Parents tab pulls from a separate endpoint — also refresh it
      // so the just-approved parent shows up there immediately.
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });

      // Show success state, then fade out and close
      setApproveSucceeded(true);
      const t1 = setTimeout(() => setApproveFadingOut(true), 900);
      const t2 = setTimeout(() => {
        closeApproveDialog();
        addNotification("Request approved — the parent can now sync their calendar", "success");
      }, 1250);
      approveTimers.current = [t1, t2];
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

  /**
   * Approve All — fires the single-approve endpoint for every pending request.
   * Each request is attempted independently: failures are collected and left in
   * the queue so the AD can handle them one-by-one. Successes are invalidated
   * from the React Query cache immediately so they disappear from the table.
   */
  const handleApproveAllConfirm = async (requests: CalendarSyncRequest[]) => {
    const total = requests.length;
    setApproveAllProgress({ done: 0, total });

    const succeeded: string[] = [];
    const failed: ApproveAllResult["failed"] = [];

    for (const req of requests) {
      try {
        const res = await fetch(`/api/admin/calendar-sync-requests/${req.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender: approveAllGender || null,
            workbookId: approveAllWorkbookId || null,
          }),
        });

        if (res.ok) {
          succeeded.push(req.id);
        } else {
          failed.push({
            id: req.id,
            parentName: req.parent.name || req.parent.email,
            sport: req.sportName,
            level: req.sportLevel,
          });
        }
      } catch {
        failed.push({
          id: req.id,
          parentName: req.parent.name || req.parent.email,
          sport: req.sportName,
          level: req.sportLevel,
        });
      }

      setApproveAllProgress((prev) => prev && { ...prev, done: prev.done + 1 });
    }

    // Refresh both sync-requests and connected-parents caches
    queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
    queryClient.invalidateQueries({ queryKey: ["connectedParents"] });

    setApproveAllProgress(null);
    setApproveAllResult({ succeeded, failed });

    if (failed.length === 0) {
      addNotification(`All ${succeeded.length} request${succeeded.length !== 1 ? "s" : ""} approved.`, "success");
    } else if (succeeded.length > 0) {
      addNotification(
        `${succeeded.length} approved, ${failed.length} failed — check the list below.`,
        "warning"
      );
    } else {
      addNotification("All approvals failed. Please try them individually.", "error");
    }
  };

  const handleApproveClick = (request: CalendarSyncRequest) => {
    setSelectedRequest(request);
    setApproveGender("");
    setApproveWorkbookId("");
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
        <>
          {/* Approve All — only shown when there are 2+ pending requests */}
          {pendingRequests.length > 1 && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<DoneAll />}
                onClick={() => setApproveAllDialogOpen(true)}
              >
                Approve All ({pendingRequests.length})
              </Button>
            </Box>
          )}

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
        </>
      )}

      {/* ── Approve All Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={approveAllDialogOpen}
        onClose={approveAllProgress ? undefined : closeApproveAllDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve All Pending Requests</DialogTitle>

        <DialogContent sx={{ minHeight: 260 }}>
          {/* In-progress */}
          {approveAllProgress && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 2 }}>
              <CircularProgress size={48} />
              <Typography variant="body1" fontWeight={600}>
                Approving {approveAllProgress.done} of {approveAllProgress.total}…
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Please keep this window open.
              </Typography>
            </Box>
          )}

          {/* Result summary */}
          {!approveAllProgress && approveAllResult && (
            <Box sx={{ pt: 1 }}>
              {approveAllResult.succeeded.length > 0 && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <strong>{approveAllResult.succeeded.length}</strong> request
                  {approveAllResult.succeeded.length !== 1 ? "s" : ""} approved successfully.
                </Alert>
              )}
              {approveAllResult.failed.length > 0 && (
                <>
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    <strong>{approveAllResult.failed.length}</strong> request
                    {approveAllResult.failed.length !== 1 ? "s" : ""} could not be approved — they
                    remain in the queue for individual review.
                  </Alert>
                  <Box sx={{ pl: 1 }}>
                    {approveAllResult.failed.map((f) => (
                      <Typography key={f.id} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        • {f.parentName} — {f.sport} {f.level}
                      </Typography>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* Form */}
          {!approveAllProgress && !approveAllResult && (
            <Box>
              <Alert severity="info" icon={<Info />} sx={{ mb: 2.5 }}>
                This will approve <strong>all {pendingRequests.length} pending requests</strong> using
                the same worksheet and gender setting. Any request that fails will stay in the queue
                for individual review.
              </Alert>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="approve-all-gender-label" shrink>
                  Gender
                </InputLabel>
                <Select
                  labelId="approve-all-gender-label"
                  value={approveAllGender}
                  label="Gender"
                  notched
                  displayEmpty
                  onChange={(e) => setApproveAllGender(e.target.value)}
                >
                  <MenuItem value=""><em>Auto-detect from sport name</em></MenuItem>
                  <MenuItem value="boys">Boys / Male</MenuItem>
                  <MenuItem value="girls">Girls / Female</MenuItem>
                  <MenuItem value="mixed">Mixed / Co-ed</MenuItem>
                </Select>
                <FormHelperText>
                  Applied to every request. Leave on Auto-detect if parents follow different sports.
                </FormHelperText>
              </FormControl>

              {/* Workbook required for Approve All */}
              <FormControl fullWidth sx={{ mb: 2 }} disabled={workbooksLoading} required>
                <InputLabel id="approve-all-workbook-label" shrink>
                  Schedule Workbook *
                </InputLabel>
                <Select
                  labelId="approve-all-workbook-label"
                  value={approveAllWorkbookId}
                  label="Schedule Workbook *"
                  notched
                  displayEmpty
                  onChange={(e) => setApproveAllWorkbookId(e.target.value)}
                >
                  <MenuItem value="" disabled>
                    <em>Select a workbook…</em>
                  </MenuItem>
                  {(workbooksData ?? []).map((wb) => {
                    const gameCount = wb._count?.games;
                    const label =
                      gameCount !== undefined ? `${wb.name}  (${gameCount} games)` : wb.name;
                    return (
                      <MenuItem key={wb.id} value={wb.id}>
                        {label}
                      </MenuItem>
                    );
                  })}
                </Select>
                <FormHelperText error={!approveAllWorkbookId && !workbooksLoading}>
                  {workbooksLoading
                    ? "Loading workbooks…"
                    : (workbooksData ?? []).length === 0
                    ? "No workbooks yet — import one in Game Center first."
                    : !approveAllWorkbookId
                    ? "Required — every parent will receive games from this workbook."
                    : "All parents will receive games from this workbook."}
                </FormHelperText>
              </FormControl>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          {!approveAllProgress && approveAllResult ? (
            <Button variant="contained" onClick={closeApproveAllDialog}>
              Done
            </Button>
          ) : !approveAllProgress ? (
            <>
              <Button onClick={closeApproveAllDialog}>Cancel</Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<DoneAll />}
                disabled={!approveAllWorkbookId || workbooksLoading}
                onClick={() => handleApproveAllConfirm(pendingRequests)}
              >
                Approve All ({pendingRequests.length})
              </Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={approveSucceeded ? undefined : closeApproveDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Calendar Sync Request</DialogTitle>

        <DialogContent sx={{ minHeight: 240 }}>
          {/* ── Success state ─────────────────────────────────────────────── */}
          {approveSucceeded ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 3,
                transition: "opacity 0.3s ease-out",
                opacity: approveFadingOut ? 0 : 1,
              }}
            >
              <CheckCircle sx={{ fontSize: 58, color: "success.main", mb: 1.5 }} />
              <Typography variant="h6" fontWeight={700} color="success.main">
                Connected Successfully
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "center" }}>
                {selectedRequest?.parent.name || selectedRequest?.parent.email} can now sync their calendar.
              </Typography>
            </Box>
          ) : (
            /* ── Form ──────────────────────────────────────────────────── */
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Approve <strong>{selectedRequest?.parent.name || selectedRequest?.parent.email}</strong>&apos;s
                request to sync <strong>{selectedRequest?.sportName} {selectedRequest?.sportLevel}</strong> games to their Google Calendar.
              </Typography>

              {/* Gender — clarifies which team games to sync.
                  `shrink` + `notched` keeps the label floating above the field
                  instead of overlapping the "Auto-detect…" placeholder text. */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="approve-gender-label" shrink>
                  Gender
                </InputLabel>
                <Select
                  labelId="approve-gender-label"
                  value={approveGender}
                  label="Gender"
                  notched
                  displayEmpty
                  onChange={(e) => setApproveGender(e.target.value)}
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

              {/* Workbook — pick from imported Game Center workbooks.
                  MenuItem children are kept as plain strings — MUI's Select
                  renders the selected MenuItem's children inside the closed
                  input, and nesting <Typography> there breaks click handling
                  on the rendered options. */}
              <FormControl fullWidth sx={{ mb: 2 }} disabled={workbooksLoading}>
                <InputLabel id="approve-workbook-label" shrink>
                  Schedule Workbook (optional)
                </InputLabel>
                <Select
                  labelId="approve-workbook-label"
                  value={approveWorkbookId}
                  label="Schedule Workbook (optional)"
                  notched
                  displayEmpty
                  onChange={(e) => setApproveWorkbookId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>All workbooks (auto-match)</em>
                  </MenuItem>
                  {(workbooksData ?? []).map((wb) => {
                    const gameCount = wb._count?.games;
                    const label =
                      gameCount !== undefined ? `${wb.name}  (${gameCount} games)` : wb.name;
                    return (
                      <MenuItem key={wb.id} value={wb.id}>
                        {label}
                      </MenuItem>
                    );
                  })}
                </Select>
                <FormHelperText>
                  {workbooksLoading
                    ? "Loading workbooks…"
                    : (workbooksData ?? []).length === 0
                    ? "No imported workbooks yet — import one in Game Center, or leave this on All workbooks."
                    : "Pick the imported workbook that holds this sport's schedule. If unset, the parent gets matching games from every workbook for this sport & level."}
                </FormHelperText>
              </FormControl>

              <Alert severity="info" icon={<Info />}>
                Once approved, the parent can sync matching games directly to their own Google Calendar.
                The gender and workbook selections help identify the right games even when your
                schedule uses shorthand like &quot;Var&quot;, &quot;G&quot;, or &quot;B Soccer JV&quot;.
              </Alert>
            </Box>
          )}
        </DialogContent>

        {!approveSucceeded && (
          <DialogActions>
            <Button onClick={closeApproveDialog}>
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
                  workbookId: approveWorkbookId || undefined,
                })
              }
            >
              {approveMutation.isPending ? <CircularProgress size={24} /> : "Approve"}
            </Button>
          </DialogActions>
        )}
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
