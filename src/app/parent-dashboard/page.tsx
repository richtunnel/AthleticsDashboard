"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Alert,
  Divider,
  Snackbar,
  Tooltip,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import {
  CalendarMonth,
  Sync,
  CheckCircle,
  Warning,
  Schedule,
  LocationOn,
  SportsScore,
  HourglassTop,
  BlockOutlined,
} from "@mui/icons-material";
import Link from "next/link";
import { formatOrgName } from "@/lib/utils/format";

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarSyncStatus = "APPROVED" | "PENDING" | "REJECTED" | "NONE";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string | null;
  sportLevel: string | null;
  schoolId: string;
  schoolName: string;
  confirmed: boolean;
  active: boolean;
  syncedAt: string | null;
  status: string;
  calendarSyncStatus: CalendarSyncStatus;
}

interface SyncRequest {
  id: string;
  sportName: string;
  sportLevel: string;
  schoolId: string;
  schoolName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

interface ParentSubscription {
  status: string;
  trialEnd: string | null;
  plan: string;
}

interface GameData {
  id: string;
  date: string;
  time: string | null;
  isHome: boolean;
  location: string | null;
  status: string;
  homeTeam: { id: string; name: string; sport: { name: string } | null; level: string | null };
  awayTeam: { id: string; name: string } | null;
  venue: { name: string; address: string | null } | null;
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
  upcomingGames: GameData[];
  calendarConnected: boolean;
  calendarSynced: boolean;
  syncRequests: SyncRequest[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchParentOverview(): Promise<ParentOverviewData> {
  const res = await fetch("/api/parent/overview");
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

async function postSyncRequest(payload: {
  schoolId: string;
  sportName: string;
  sportLevel: string;
}): Promise<void> {
  const res = await fetch("/api/parent/calendar-sync-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send request");
}

async function deleteSyncRequest(id: string): Promise<void> {
  const res = await fetch(`/api/parent/calendar-sync-requests/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to cancel request");
  }
}

function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

type Snack = { open: boolean; message: string; severity: AlertColor };
const CLOSED_SNACK: Snack = { open: false, message: "", severity: "success" };

// ── Child card ────────────────────────────────────────────────────────────────

interface ChildCardProps {
  link: ParentLink;
  pendingRequestId: string | null;
  approvedRequestId: string | null;
  /** True when this parent has Google Calendar OAuth connected */
  calendarConnected: boolean;
  onRequest: (link: ParentLink) => void;
  onCancel: (requestId: string) => void;
  onUnsync: (requestId: string) => void;
  onSyncNow: () => void;
  requesting: boolean;
  cancelling: boolean;
  unsyncing: boolean;
}

function ChildCard({
  link,
  pendingRequestId,
  approvedRequestId,
  calendarConnected,
  onRequest,
  onCancel,
  onUnsync,
  onSyncNow,
  requesting,
  cancelling,
  unsyncing,
}: ChildCardProps) {
  const { calendarSyncStatus } = link;

  const syncChip = () => {
    switch (calendarSyncStatus) {
      case "APPROVED":
        // "APPROVED" only means the AD allowed sync — it does NOT mean games
        // are actually in the parent's Google Calendar. The actual sync
        // requires the parent to connect Google Calendar and trigger it.
        // Label this accurately so parents aren't misled.
        return (
          <Tooltip title="The athletic director approved your request. Connect Google Calendar to push games to your calendar.">
            <Chip
              icon={<CheckCircle />}
              label="Sync Approved"
              size="small"
              color="success"
              variant="outlined"
            />
          </Tooltip>
        );
      case "PENDING":
        return (
          <Tooltip title="Waiting for the athletic director to approve your sync request">
            <Chip icon={<HourglassTop />} label="Pending Approval" size="small" color="warning" variant="outlined" />
          </Tooltip>
        );
      case "REJECTED":
        return (
          <Chip icon={<BlockOutlined />} label="Sync Removed" size="small" color="error" variant="outlined" />
        );
      default:
        return (
          <Chip icon={<Warning />} label="Not Synced" size="small" color="default" variant="outlined" />
        );
    }
  };

  const canRequest = !!link.sportName && !!link.sportLevel;
  const showRequestButton =
    (calendarSyncStatus === "REJECTED" || calendarSyncStatus === "NONE") &&
    !!link.schoolId;

  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", borderColor: calendarSyncStatus === "REJECTED" ? "error.light" : undefined }}
    >
      <CardContent sx={{ pb: "12px !important" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {link.sportName || "—"}
          </Typography>
          {link.sportLevel && (
            <Chip label={link.sportLevel} size="small" color="primary" variant="outlined" />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {formatOrgName(link.schoolName)}
        </Typography>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>Athlete:</strong> {link.childName}
        </Typography>

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {syncChip()}

          {/* State: NONE or REJECTED — let the parent issue a request */}
          {showRequestButton && (
            <Tooltip
              title={
                canRequest
                  ? ""
                  : "Add a sport and level for this child in Settings before requesting sync."
              }
            >
              <span style={{ marginLeft: "auto" }}>
                <Button
                  size="small"
                  variant={calendarSyncStatus === "REJECTED" ? "contained" : "outlined"}
                  color="primary"
                  startIcon={requesting ? <CircularProgress size={12} color="inherit" /> : <Sync />}
                  disabled={requesting || !canRequest}
                  onClick={() => onRequest(link)}
                  sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                >
                  {requesting ? "Sending…" : calendarSyncStatus === "REJECTED" ? "Request Re-sync" : "Request Sync"}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* State: PENDING — let the parent cancel and try again */}
          {calendarSyncStatus === "PENDING" && pendingRequestId && (
            <Tooltip title="Cancel this pending request so you can send a fresh one">
              <span style={{ marginLeft: "auto" }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  disabled={cancelling}
                  onClick={() => onCancel(pendingRequestId)}
                  sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                >
                  {cancelling ? "Cancelling…" : "Cancel Request"}
                </Button>
              </span>
            </Tooltip>
          )}

          {/* State: APPROVED — show actual sync controls.
              The AD said yes; the parent still needs to (a) connect Google
              Calendar if they haven't, then (b) push the games. They can
              also Unsync to drop the approval and start over. */}
          {calendarSyncStatus === "APPROVED" && approvedRequestId && (
            <Box sx={{ display: "flex", gap: 1, ml: "auto", flexWrap: "wrap" }}>
              {!calendarConnected ? (
                <Tooltip title="Connect your Google Calendar so games can be pushed to it">
                  <Button
                    component={Link}
                    href="/parent-dashboard/calendar-sync"
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<Sync />}
                    sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                  >
                    Connect Calendar
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="Push the latest games for this sport to your Google Calendar. Use this any time the schedule changes.">
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<Sync />}
                    onClick={onSyncNow}
                    sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                  >
                    Update Sync
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Stop syncing this sport and remove the approval so you can re-request later">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={unsyncing}
                    onClick={() => onUnsync(approvedRequestId)}
                    sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                  >
                    {unsyncing ? "Unsyncing…" : "Unsync"}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>

        {calendarSyncStatus === "REJECTED" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            The athletic director removed your calendar access. Send a request to restore it.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ParentDashboardPage() {
  const queryClient = useQueryClient();
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(CLOSED_SNACK);

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

  const syncMutation = useMutation({
    mutationFn: postSyncRequest,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      setSnack({
        open: true,
        message: `Re-sync request sent for ${vars.sportName}. The athletic director will review it shortly.`,
        severity: "success",
      });
    },
    onError: (err: Error) => {
      setSnack({ open: true, message: err.message, severity: "error" });
    },
    onSettled: () => setRequestingId(null),
  });

  const handleRequest = (link: ParentLink) => {
    // Defensive guard — UI also disables the button when these are missing,
    // but never trust the UI alone.
    if (!link.sportName || !link.sportLevel) {
      setSnack({
        open: true,
        message: "Please add a sport and level for this child in Settings before requesting sync.",
        severity: "warning",
      });
      return;
    }
    setRequestingId(link.id);
    syncMutation.mutate({
      schoolId: link.schoolId,
      sportName: link.sportName,
      sportLevel: link.sportLevel,
    });
  };

  const cancelMutation = useMutation({
    mutationFn: deleteSyncRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      setSnack({
        open: true,
        message: "Pending request cancelled. You can now send a fresh one.",
        severity: "success",
      });
    },
    onError: (err: Error) => {
      setSnack({ open: true, message: err.message, severity: "error" });
    },
    onSettled: () => setCancellingId(null),
  });

  const handleCancel = (requestId: string) => {
    setCancellingId(requestId);
    cancelMutation.mutate(requestId);
  };

  // Unsync = same DELETE endpoint but used against an APPROVED request.
  // Drops the approval row + flips connectedParent.calendarSynced=false,
  // so the parent can re-request from scratch.
  const [unsyncingId, setUnsyncingId] = useState<string | null>(null);
  const unsyncMutation = useMutation({
    mutationFn: deleteSyncRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      setSnack({
        open: true,
        message: "Unsynced. You can request a new sync any time from this card.",
        severity: "success",
      });
    },
    onError: (err: Error) => {
      setSnack({ open: true, message: err.message, severity: "error" });
    },
    onSettled: () => setUnsyncingId(null),
  });
  const handleUnsync = (requestId: string) => {
    setUnsyncingId(requestId);
    unsyncMutation.mutate(requestId);
  };
  const handleSyncNow = () => {
    // Deep-link to the dedicated calendar-sync page where the parent picks
    // a Google calendar and we run the actual push. Doing it from here would
    // require duplicating the calendar-picker UI.
    window.location.href = "/parent-dashboard/calendar-sync";
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load dashboard. Please try again.</Alert>;
  }

  const { subscription, upcomingGames = [], links = [], calendarConnected, syncRequests = [] } = data!;
  const isOnTrial = subscription?.status === "TRIALING";
  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString() : null;
  const revokedLinks = links.filter((l) => l.calendarSyncStatus === "REJECTED");

  // Map each link's slot key → IDs of its current PENDING / APPROVED requests.
  // Used by ChildCard to render the right buttons for each state.
  const pendingIdBySlot = new Map<string, string>();
  const approvedIdBySlot = new Map<string, string>();
  for (const req of syncRequests) {
    const key = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
    if (req.status === "PENDING" && !pendingIdBySlot.has(key)) pendingIdBySlot.set(key, req.id);
    if (req.status === "APPROVED" && !approvedIdBySlot.has(key)) approvedIdBySlot.set(key, req.id);
  }
  const slotKeyForLink = (link: ParentLink): string | null => {
    if (!link.sportName || !link.sportLevel) return null;
    return `${link.schoolId}|${link.sportName.toLowerCase()}|${link.sportLevel.toLowerCase()}`;
  };
  const pendingIdForLink = (link: ParentLink): string | null => {
    const k = slotKeyForLink(link);
    return k ? pendingIdBySlot.get(k) ?? null : null;
  };
  const approvedIdForLink = (link: ParentLink): string | null => {
    const k = slotKeyForLink(link);
    return k ? approvedIdBySlot.get(k) ?? null : null;
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Welcome to Parent Portal
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Stay up-to-date with your child&apos;s game schedule
        </Typography>
      </Box>

      {isOnTrial && trialEnd && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your free trial ends on {trialEnd}. Continue with Parent Power for $2.25/month to keep calendar sync.
        </Alert>
      )}

      {revokedLinks.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component={Link} href="/parent-dashboard/settings">
              Manage
            </Button>
          }
        >
          {revokedLinks.length === 1
            ? `Your calendar sync for ${revokedLinks[0].sportName} was removed by the athletic director.`
            : `${revokedLinks.length} of your calendar syncs were removed by the athletic director.`}{" "}
          Use the card below to request access back.
        </Alert>
      )}

      {/* Upcoming Schedule */}
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        <Schedule sx={{ verticalAlign: "middle", mr: 1 }} />
        Upcoming Schedule
      </Typography>

      {upcomingGames.length > 0 ? (
        <Box sx={{ mb: 4 }}>
          {upcomingGames.map((game) => (
            <Card key={game.id} variant="outlined" sx={{ mb: 1.5 }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                    <Box sx={{ textAlign: "center", minWidth: 60 }}>
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {formatGameDate(game.date)}
                      </Typography>
                      {game.time && (
                        <Typography variant="caption" color="text.secondary">
                          {game.time}
                        </Typography>
                      )}
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {game.homeTeam?.sport?.name || "Game"}
                        </Typography>
                        {game.homeTeam?.level && <Chip label={game.homeTeam.level} size="small" variant="outlined" />}
                        <Chip label={game.isHome ? "Home" : "Away"} size="small" color={game.isHome ? "success" : "warning"} variant="outlined" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {game.isHome ? `vs ${game.awayTeam?.name || "TBD"}` : `at ${game.awayTeam?.name || "TBD"}`}
                      </Typography>
                    </Box>
                  </Box>
                  {(game.venue?.name || game.location) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {game.venue?.name || game.location}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <SportsScore sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography variant="body1" color="text.secondary">No upcoming games scheduled</Typography>
            <Typography variant="body2" color="text.secondary">
              Games will appear here once they are added to the schedule
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { icon: <CalendarMonth sx={{ fontSize: 40, color: "primary.main" }} />, value: links.length, label: "Connected Sports" },
          {
            // Reflects whether Google Calendar OAuth is connected — NOT whether
            // any games have been pushed. Worded so parents don't mistake
            // "Connected" for "Synced". Per-sport sync state lives on the
            // child cards below.
            icon: <Sync sx={{ fontSize: 40, color: calendarConnected ? "success.main" : "text.secondary" }} />,
            value: calendarConnected ? "Connected" : "Not Connected",
            label: "Google Calendar",
          },
          { icon: <Schedule sx={{ fontSize: 40, color: "primary.main" }} />, value: upcomingGames.length, label: "Upcoming Games" },
          { icon: <CheckCircle sx={{ fontSize: 40, color: "success.main" }} />, value: "Active", label: "Membership" },
        ].map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card>
              <CardContent sx={{ textAlign: "center" }}>
                {stat.icon}
                <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Child / sport cards */}
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        Your Sports
      </Typography>

      {links.length === 0 ? (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent sx={{ textAlign: "center", py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              No sports linked yet. Add a child to get started.
            </Typography>
            <Button variant="contained" component={Link} href="/onboarding/parent" sx={{ mt: 2 }}>
              Add Athlete
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {links.map((link) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={link.id}>
              <ChildCard
                link={link}
                pendingRequestId={pendingIdForLink(link)}
                approvedRequestId={approvedIdForLink(link)}
                calendarConnected={calendarConnected}
                onRequest={handleRequest}
                onCancel={handleCancel}
                onUnsync={handleUnsync}
                onSyncNow={handleSyncNow}
                requesting={requestingId === link.id}
                cancelling={cancellingId === pendingIdForLink(link)}
                unsyncing={unsyncingId === approvedIdForLink(link)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Quick Actions */}
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        Quick Actions
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant="contained" component={Link} href="/parent-dashboard/settings">
          Manage Settings
        </Button>
        <Button variant="outlined" component={Link} href="/parent-dashboard/chat">
          Contact Athletic Director
        </Button>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack(CLOSED_SNACK)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnack(CLOSED_SNACK)} severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
