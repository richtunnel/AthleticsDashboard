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

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarSyncStatus = "APPROVED" | "PENDING" | "REJECTED" | "NONE";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
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
  onRequest: (link: ParentLink) => void;
  requesting: boolean;
}

function ChildCard({ link, onRequest, requesting }: ChildCardProps) {
  const { calendarSyncStatus } = link;

  const syncChip = () => {
    switch (calendarSyncStatus) {
      case "APPROVED":
        return (
          <Chip icon={<CheckCircle />} label="Calendar Synced" size="small" color="success" variant="outlined" />
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

  const showRequestButton = calendarSyncStatus === "REJECTED" || calendarSyncStatus === "NONE";

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
          {link.schoolName}
        </Typography>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <strong>Athlete:</strong> {link.childName}
          {link.childGrade && ` · Grade ${link.childGrade}`}
        </Typography>

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {syncChip()}
          {showRequestButton && (
            <Button
              size="small"
              variant={calendarSyncStatus === "REJECTED" ? "contained" : "outlined"}
              color="primary"
              startIcon={requesting ? <CircularProgress size={12} color="inherit" /> : <Sync />}
              disabled={requesting}
              onClick={() => onRequest(link)}
              sx={{ ml: "auto", fontSize: "0.75rem", py: 0.4, px: 1.25 }}
            >
              {requesting ? "Sending…" : calendarSyncStatus === "REJECTED" ? "Request Re-sync" : "Request Sync"}
            </Button>
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
    if (!link.sportName || !link.schoolId) return;
    setRequestingId(link.id);
    syncMutation.mutate({ schoolId: link.schoolId, sportName: link.sportName, sportLevel: link.sportLevel });
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

  const { subscription, upcomingGames = [], links = [], calendarConnected } = data!;
  const isOnTrial = subscription?.status === "TRIALING";
  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString() : null;
  const revokedLinks = links.filter((l) => l.calendarSyncStatus === "REJECTED");

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
                        {game.homeTeam?.level && (
                          <Chip label={game.homeTeam.level} size="small" variant="outlined" />
                        )}
                        <Chip
                          label={game.isHome ? "Home" : "Away"}
                          size="small"
                          color={game.isHome ? "success" : "warning"}
                          variant="outlined"
                        />
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
            icon: <Sync sx={{ fontSize: 40, color: calendarConnected ? "success.main" : "text.secondary" }} />,
            value: calendarConnected ? "Active" : "None",
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
              <ChildCard link={link} onRequest={handleRequest} requesting={requestingId === link.id} />
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
