"use client";

import { useState, useCallback, useEffect } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
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
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import Link from "next/link";
import { formatOrgName } from "@/lib/utils/format";
import { useJobStatus } from "@/hooks/useJobStatus";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import { useNotifications } from "@/contexts/NotificationContext";

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
  googleCalendarId: string | null;
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
  homeTeam: { id: string; name: string; sport: { name: string } | null; level: string | null } | null;
  awayTeam: { id: string; name: string } | null;
  /** Opponent record — populated for most workbook-imported games instead of awayTeam */
  opponent: { id: string; name: string } | null;
  venue: { name: string; address: string | null } | null;
  /**
   * IDs of the ParentAthleteLinks that caused this game to appear.
   * Set by the API during team/workbook resolution — used for exact-match
   * tab isolation so the client never has to do fuzzy sport/level matching.
   * Empty array means the game has no attributed child (orphan workbook path).
   */
  linkIds: string[];
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
  upcomingGames: GameData[];
  calendarConnected: boolean;
  calendarSynced: boolean;
  syncRequests: SyncRequest[];
}

interface ApprovedRequestRef {
  id: string;
  googleCalendarId: string | null;
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

function formatGameTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return timeStr;
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${(parts[1] || "00").padStart(2, "0")} ${period}`;
}

type Snack = { open: boolean; message: string; severity: AlertColor };
const CLOSED_SNACK: Snack = { open: false, message: "", severity: "success" };

// ── Child card ────────────────────────────────────────────────────────────────

interface ChildCardProps {
  link: ParentLink;
  pendingRequestId: string | null;
  approvedRequest: ApprovedRequestRef | null;
  calendarConnected: boolean;
  onRequest: (link: ParentLink) => void;
  onUnsync: (linkId: string, requestId: string) => void;
  requesting: boolean;
  unsyncing: boolean;
  onSnack: (msg: string, severity: AlertColor) => void;
}

function ChildCard({
  link,
  pendingRequestId,
  approvedRequest,
  calendarConnected,
  onRequest,
  onUnsync,
  requesting,
  unsyncing,
  onSnack,
}: ChildCardProps) {
  const queryClient = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { snapshot } = useJobStatus(activeJobId);
  const isBusy = snapshot?.status === "PENDING" || snapshot?.status === "PROCESSING";

  useEffect(() => {
    if (snapshot?.status === "COMPLETED") {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      setActiveJobId(null);
    }
  }, [snapshot?.status, queryClient]);

  const handleSyncNow = useCallback(async () => {
    if (!approvedRequest) return;

    // "Update Sync" = rescan the AD's worksheet for new games matching this
    // child. NOT a Google Calendar operation. Hit a dedicated rescan endpoint
    // that refreshes the parent's overview cache and returns updated counts.
    // No calendar picker, no calendar API calls — just a worksheet refresh.
    try {
      const res = await fetch(
        `/api/parent/calendar-sync-requests/${approvedRequest.id}/rescan`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        onSnack(data.error || "Failed to refresh schedule", "error");
        return;
      }
      const added = data?.result?.added ?? 0;
      onSnack(
        added > 0
          ? `Schedule refreshed — ${added} new game${added === 1 ? "" : "s"} found.`
          : "Schedule is up to date.",
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
    } catch (err: any) {
      onSnack(err.message || "Network error", "error");
    }
  }, [approvedRequest, onSnack, queryClient]);

  const handleRetry = useCallback(async () => {
    setActiveJobId(null);
    await handleSyncNow();
  }, [handleSyncNow]);

  const { calendarSyncStatus } = link;

  const syncChip = () => {
    switch (calendarSyncStatus) {
      case "APPROVED":
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

          {calendarSyncStatus === "APPROVED" && approvedRequest && (
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
              ) : snapshot?.status === "COMPLETED" ? (
                <Chip
                  icon={<CheckCircle />}
                  label={`${snapshot.result?.added ?? 0} games synced`}
                  color="success"
                  size="small"
                />
              ) : snapshot?.status === "FAILED" ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="caption" color="error">
                    {snapshot.error || "Sync failed"}
                  </Typography>
                  <Tooltip title="Retry sync with a fresh attempt">
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<Warning />}
                      onClick={handleRetry}
                      sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                    >
                      Retry
                    </Button>
                  </Tooltip>
                </Box>
              ) : (
                <Tooltip title="Push the latest games for this sport to your Google Calendar. Use this any time the schedule changes.">
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={isBusy ? <CircularProgress size={12} color="inherit" /> : <Sync />}
                      disabled={isBusy}
                      onClick={handleSyncNow}
                      sx={{ fontSize: "0.75rem", py: 0.4, px: 1.25 }}
                    >
                      {isBusy
                        ? `Syncing… attempt ${snapshot?.attempts ?? 1}`
                        : "Update Sync"}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <Tooltip title="Stop syncing this sport and remove the approval so you can re-request later">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={unsyncing || isBusy}
                    onClick={() => onUnsync(link.id, approvedRequest.id)}
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
  const { addNotification } = useNotifications();
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack>(CLOSED_SNACK);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [activeChildTab, setActiveChildTab] = useState(0);
  const [scheduleSyncing, setScheduleSyncing] = useState(false);
  // Anchors for first-login parent tips on this page
  const [scheduleHeaderEl, setScheduleHeaderEl] = useState<HTMLElement | null>(null);
  const [syncBtnEl, setSyncBtnEl] = useState<HTMLButtonElement | null>(null);
  const [addAthleteBtnEl, setAddAthleteBtnEl] = useState<HTMLButtonElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
    refetchOnMount: "always",
  });

  const syncMutation = useMutation({
    mutationFn: postSyncRequest,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      const msg = `Sync request sent for ${vars.sportName}. The athletic director will review it shortly.`;
      setSnack({ open: true, message: msg, severity: "success" });
      addNotification(msg, "success");
    },
    onError: (err: Error) => {
      setSnack({ open: true, message: err.message, severity: "error" });
      addNotification(err.message, "error");
    },
    onSettled: () => setRequestingId(null),
  });

  const handleRequest = (link: ParentLink) => {
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

  const [unsyncingId, setUnsyncingId] = useState<string | null>(null);
  const unsyncMutation = useMutation({
    mutationFn: deleteSyncRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      const msg = "Unsynced. You can request a new sync any time from this card.";
      setSnack({ open: true, message: msg, severity: "success" });
      addNotification(msg, "info");
    },
    onError: (err: Error) => {
      setSnack({ open: true, message: err.message, severity: "error" });
      addNotification(err.message, "error");
    },
    onSettled: () => setUnsyncingId(null),
  });

  const handleUnsync = (linkId: string, requestId: string) => {
    setUnsyncingId(linkId);
    unsyncMutation.mutate(requestId);
  };

  // ── Schedule-level calendar sync ─────────────────────────────────────────
  //
  // "Sync to Calendar" pushes the games for the CURRENTLY-VIEWED child tab to
  // the parent's Google Calendar. Logic mirrors how the AD's Connected Parents
  // sync works:
  //
  //   1. Identify which sync requests belong to the active child (matched by
  //      childName → schoolId + sport + level on each ParentAthleteLink).
  //   2. For each one, resolve a target Google Calendar:
  //        a. Use the calendar already persisted on the sync request.
  //        b. If none, auto-fetch the parent's calendar list and pick "primary".
  //   3. POST /api/parent/calendar-sync-requests/{id}/sync per matched request.
  //      That route runs syncGamesForSportLevel (the same service the AD uses).
  //
  // If the parent hasn't connected Google Calendar at all → redirect to setup.
  const handleScheduleSync = async (
    syncRequests: SyncRequest[],
    calendarConnected: boolean,
    activeChildName: string | null,
    childLinks: ParentLink[]
  ) => {
    if (!calendarConnected) {
      window.location.href = "/parent-dashboard/calendar-sync";
      return;
    }

    // Scope to the active child's sport/level slots. With a single child the
    // filter is a no-op (every request belongs to them anyway).
    const activeChildLinks = activeChildName
      ? childLinks.filter((l) => l.childName === activeChildName)
      : childLinks;
    const activeSlots = new Set(
      activeChildLinks
        .filter((l) => l.sportName && l.sportLevel)
        .map((l) =>
          `${l.schoolId}|${(l.sportName ?? "").toLowerCase()}|${(l.sportLevel ?? "").toLowerCase()}`
        )
    );

    const childRequests = syncRequests.filter((r) => {
      if (r.status !== "APPROVED") return false;
      if (activeSlots.size === 0) return false;
      const slot = `${r.schoolId}|${r.sportName.toLowerCase()}|${r.sportLevel.toLowerCase()}`;
      return activeSlots.has(slot);
    });

    if (childRequests.length === 0) {
      const msg = activeChildName
        ? `No approved sync for ${activeChildName} yet. Request sync on the child card first.`
        : "No approved sync requests yet. Request sync on a child card first.";
      setSnack({ open: true, message: msg, severity: "warning" });
      addNotification(msg, "warning");
      return;
    }

    setScheduleSyncing(true);
    setSnack({ open: true, message: "Starting calendar sync…", severity: "info" });

    // Resolve target calendar lazily — we only need the calendar list when at
    // least one request lacks a persisted googleCalendarId.
    let cachedPrimaryCalendarId: string | null | undefined = undefined;
    const resolveCalendarId = async (req: SyncRequest): Promise<string | null> => {
      if (req.googleCalendarId) return req.googleCalendarId;
      if (cachedPrimaryCalendarId !== undefined) return cachedPrimaryCalendarId;
      try {
        const listRes = await fetch("/api/parent/calendar/list");
        if (listRes.ok) {
          const data = await listRes.json();
          const calendars: Array<{ id: string; primary?: boolean }> = data.calendars || [];
          const primary = calendars.find((c) => c.primary);
          if (primary) {
            cachedPrimaryCalendarId = primary.id;
          } else if (calendars.length === 1) {
            cachedPrimaryCalendarId = calendars[0].id;
          } else {
            cachedPrimaryCalendarId = null;
          }
        } else {
          cachedPrimaryCalendarId = null;
        }
      } catch {
        cachedPrimaryCalendarId = null;
      }
      return cachedPrimaryCalendarId;
    };

    let triggered = 0;
    let skipped = 0;
    for (const req of childRequests) {
      const targetCalendarId = await resolveCalendarId(req);
      if (!targetCalendarId) {
        skipped++;
        continue;
      }
      try {
        const res = await fetch(`/api/parent/calendar-sync-requests/${req.id}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            googleCalendarId: targetCalendarId,
            idempotencyToken: crypto.randomUUID(),
          }),
        });
        if (res.ok) triggered++;
        else skipped++;
      } catch {
        skipped++;
      }
    }

    setScheduleSyncing(false);

    const who = activeChildName ? ` for ${activeChildName}` : "";
    let syncMsg: string;
    let syncSeverity: AlertColor;
    if (triggered > 0) {
      syncMsg = `Calendar sync started${who} (${triggered} sport${triggered > 1 ? "s" : ""}). Your Google Calendar will update shortly.`;
      syncSeverity = "success";
    } else if (skipped > 0 && cachedPrimaryCalendarId === null) {
      syncMsg = "Could not find a Google Calendar to sync to. Connect your calendar in Settings.";
      syncSeverity = "error";
    } else {
      syncMsg = "Couldn't start sync. Check your calendar connection in Settings.";
      syncSeverity = "error";
    }
    setSnack({ open: true, message: syncMsg, severity: syncSeverity });
    addNotification(syncMsg, syncSeverity);
    queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
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

  // ── Schedule box title ────────────────────────────────────────────────────
  // Build "Emma · Varsity Basketball Schedule²⁰²⁵" from the primary link.
  // If multiple children share the same name the first entry is used; if
  // multiple sports exist for the same child we surface just the first one
  // so the label stays readable on mobile.
  const currentYear = new Date().getFullYear();
  const primaryLink = links.find((l) => l.sportName && l.sportLevel) ?? links[0] ?? null;
  // Ordered list of unique child names (insertion order = most-recently-added first).
  const uniqueChildNames = [...new Set(links.map((l) => l.childName))];

  // Guard against stale tab index after a child is removed (data refresh).
  const safeActiveTab = Math.min(activeChildTab, Math.max(0, uniqueChildNames.length - 1));

  // Schedule chip label — tab-aware when multiple children are linked.
  const scheduleLabel = (() => {
    if (!primaryLink) return null;
    if (uniqueChildNames.length > 1) {
      const activeName = uniqueChildNames[safeActiveTab] ?? uniqueChildNames[0];
      const activeChildLinks = links.filter((l) => l.childName === activeName);
      const activeLink =
        activeChildLinks.find((l) => l.sportName && l.sportLevel) ?? activeChildLinks[0];
      const sportPart =
        activeLink?.sportLevel && activeLink?.sportName
          ? `${activeLink.sportLevel} ${activeLink.sportName}`
          : activeLink?.sportName ?? activeLink?.sportLevel ?? null;
      // Multiple sports for one child → omit sport from chip to keep it readable.
      return { name: activeName, sport: activeChildLinks.length > 1 ? null : sportPart };
    }
    const namePart = primaryLink.childName;
    const sportPart =
      primaryLink.sportLevel && primaryLink.sportName
        ? `${primaryLink.sportLevel} ${primaryLink.sportName}`
        : primaryLink.sportName ?? primaryLink.sportLevel ?? null;
    return { name: namePart, sport: sportPart };
  })();

  // ── Per-child game isolation ──────────────────────────────────────────────
  // The API tags every game with the ParentAthleteLink IDs that caused it to
  // be fetched (via team match OR workbook match).  We do an exact Set lookup
  // here — no fuzzy string matching, no risk of cross-child contamination.
  //
  // Fast paths:
  //  • Single child  → return full list (no filtering, includes orphan games)
  //  • No linkIds    → fall back gracefully (older cached responses)
  const gamesForActiveTab = (() => {
    if (uniqueChildNames.length <= 1) return upcomingGames;

    const activeName = uniqueChildNames[safeActiveTab] ?? uniqueChildNames[0];
    const activeLinkIds = new Set(
      links.filter((l) => l.childName === activeName).map((l) => l.id)
    );

    return upcomingGames.filter((game) => {
      // Graceful fallback for cached responses that pre-date the linkIds field.
      if (!game.linkIds || game.linkIds.length === 0) return false;
      return game.linkIds.some((id) => activeLinkIds.has(id));
    });
  })();

  const pendingIdBySlot = new Map<string, string>();
  const approvedRefBySlot = new Map<string, ApprovedRequestRef>();
  for (const req of syncRequests) {
    const key = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
    if (req.status === "PENDING" && !pendingIdBySlot.has(key)) pendingIdBySlot.set(key, req.id);
    if (req.status === "APPROVED" && !approvedRefBySlot.has(key)) {
      approvedRefBySlot.set(key, { id: req.id, googleCalendarId: req.googleCalendarId });
    }
  }

  const slotKeyForLink = (link: ParentLink): string | null => {
    if (!link.sportName || !link.sportLevel) return null;
    return `${link.schoolId}|${link.sportName.toLowerCase()}|${link.sportLevel.toLowerCase()}`;
  };
  const pendingIdForLink = (link: ParentLink): string | null => {
    const k = slotKeyForLink(link);
    return k ? pendingIdBySlot.get(k) ?? null : null;
  };
  const approvedRefForLink = (link: ParentLink): ApprovedRequestRef | null => {
    const k = slotKeyForLink(link);
    return k ? approvedRefBySlot.get(k) ?? null : null;
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography ref={setScheduleHeaderEl} variant="h5" fontWeight={600}>
          <Schedule sx={{ verticalAlign: "middle", mr: 1 }} />
          Upcoming Schedule
        </Typography>
        <Tooltip
          title={
            !calendarConnected
              ? "Connect your Google Calendar to enable syncing"
              : syncRequests.some((r) => r.status === "APPROVED" && r.googleCalendarId)
              ? "Push all approved sport schedules to your Google Calendar"
              : "Set up calendar sync to push games automatically"
          }
        >
          <span>
            <Button
              ref={setSyncBtnEl}
              size="small"
              variant="outlined"
              startIcon={scheduleSyncing ? <CircularProgress size={13} color="inherit" /> : <Sync />}
              disabled={scheduleSyncing}
              onClick={() =>
                handleScheduleSync(
                  syncRequests,
                  calendarConnected,
                  // null when there's only one child — every request is "theirs"
                  uniqueChildNames.length > 1
                    ? uniqueChildNames[safeActiveTab] ?? null
                    : null,
                  links
                )
              }
              sx={{ fontSize: "0.75rem", py: 0.5, px: 1.5, textTransform: "none" }}
            >
              {scheduleSyncing ? "Syncing…" : "Sync to Calendar"}
            </Button>
          </span>
        </Tooltip>
        <TipBubble
          tipId={TIP_IDS.PARENT_UPCOMING_SCHEDULE}
          anchorEl={scheduleHeaderEl}
          placement="bottom-start"
          title="Your athlete's upcoming games"
          body="Every game from the sports you've connected appears here — date, time, opponent, and venue — so you always know where to be and when."
        />
        <TipBubble
          tipId={TIP_IDS.PARENT_SYNC_TO_CALENDAR}
          anchorEl={syncBtnEl}
          placement="bottom-end"
          title="Sync to your Google Calendar"
          body="Click here to push every upcoming game directly to your Google Calendar — including any schedule changes — so it lives alongside the rest of your appointments."
        />
      </Box>

      {/* Per-child schedule tabs — only rendered when the parent has more than one child */}
      {uniqueChildNames.length > 1 && (
        <Tabs
          value={safeActiveTab}
          onChange={(_, newVal) => {
            setActiveChildTab(newVal as number);
            setScheduleExpanded(false);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 1.5, borderBottom: 1, borderColor: "divider" }}
        >
          {uniqueChildNames.map((name, i) => (
            <Tab
              key={i}
              label={name}
              sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.85rem" }}
            />
          ))}
        </Tabs>
      )}

      {gamesForActiveTab.length > 0 ? (
        <>
        {/* Scrollable list — collapses to 400 px, expands on demand */}
        <Box
          sx={{
            mb: 0.5,
            maxHeight: scheduleExpanded ? 1000 : 400,
            transition: "max-height 0.35s ease",
            overflowY: "auto",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1.5,
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
            "&::-webkit-scrollbar-thumb": { bgcolor: "action.selected", borderRadius: 3 },
          }}
        >
          {/* ── Title chip ────────────────────────────────────────────────── */}
          {scheduleLabel && (
            <Chip
              label={
                [
                  scheduleLabel.name,
                  scheduleLabel.sport ? `· ${scheduleLabel.sport}` : null,
                  `Schedule ${currentYear}`,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              sx={{
                mb: 1.5,
                fontWeight: 700,
                fontSize: { xs: "0.8rem", sm: "0.95rem" },
                height: "auto",
                py: 0.5,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "#2e3478" : "#181B38",
                color: "#fff",
                border: "none",
                "& .MuiChip-label": { px: 1.5, whiteSpace: "normal" },
                "&:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#2e3478" : "#181B38",
                },
              }}
            />
          )}

          {gamesForActiveTab.map((game) => {
            const cancelled = game.status === "CANCELLED";
            return (
            <Card
              key={game.id}
              variant="outlined"
              elevation={0}
              sx={{
                mb: 0.75,
                boxShadow: "none",
                ...(cancelled && { borderColor: "error.light", opacity: 0.85 }),
              }}
            >
              <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 0.75 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                    <Box sx={{ textAlign: "center", minWidth: 52 }}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        display="block"
                        sx={{
                          color: cancelled ? "error.main" : "primary.main",
                          textDecoration: cancelled ? "line-through" : "none",
                        }}
                      >
                        {formatGameDate(game.date)}
                      </Typography>
                      {game.time && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: "0.65rem", textDecoration: cancelled ? "line-through" : "none" }}
                        >
                          {formatGameTime(game.time)}
                        </Typography>
                      )}
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          noWrap
                          sx={{ textDecoration: cancelled ? "line-through" : "none", color: cancelled ? "text.disabled" : "inherit" }}
                        >
                          {game.homeTeam?.sport?.name || "Game"}
                        </Typography>
                        {game.homeTeam?.level && (
                          <Chip
                            label={game.homeTeam.level}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", height: 18, opacity: cancelled ? 0.5 : 1 }}
                          />
                        )}
                        {cancelled ? (
                          <Chip
                            label="Cancelled"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", height: 18 }}
                          />
                        ) : (
                          <Chip
                            label={game.isHome ? "Home" : "Away"}
                            size="small"
                            color={game.isHome ? "success" : "warning"}
                            variant="outlined"
                            sx={{ fontSize: "0.65rem", height: 18 }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontSize: "0.7rem",
                          color: cancelled ? "text.disabled" : "text.secondary",
                          textDecoration: cancelled ? "line-through" : "none",
                        }}
                      >
                        {game.isHome
                          ? `vs ${game.awayTeam?.name || game.opponent?.name || "TBD"}`
                          : `at ${game.awayTeam?.name || game.opponent?.name || "TBD"}`}
                      </Typography>
                    </Box>
                  </Box>
                  {(game.venue?.name || game.location) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <LocationOn sx={{ fontSize: 13 }} color="action" />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ fontSize: "0.7rem", textDecoration: cancelled ? "line-through" : "none" }}
                      >
                        {game.venue?.name || game.location}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
            );
          })}
        </Box>

        {/* Expand / collapse toggle */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setScheduleExpanded((v) => !v)}
            endIcon={scheduleExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            sx={{ fontSize: "0.72rem", color: "text.secondary", textTransform: "none", px: 1.5 }}
          >
            {scheduleExpanded ? "Collapse schedule" : "Expand schedule"}
          </Button>
        </Box>
        </>
      ) : (
        /* Empty state — same fixed height as the collapsed scrollable list */
        <Card
          variant="outlined"
          sx={{ mb: 4, height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <CardContent sx={{ textAlign: "center" }}>
            <SportsScore sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
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
                approvedRequest={approvedRefForLink(link)}
                calendarConnected={calendarConnected}
                onRequest={handleRequest}
                onUnsync={handleUnsync}
                requesting={requestingId === link.id}
                unsyncing={unsyncingId === link.id}
                onSnack={(msg, sev) => {
                  setSnack({ open: true, message: msg, severity: sev });
                  addNotification(msg, sev === "success" || sev === "error" || sev === "warning" ? sev : "info");
                }}
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
