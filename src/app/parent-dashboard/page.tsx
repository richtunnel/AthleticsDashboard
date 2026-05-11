"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Card, CardContent, Grid, Chip, CircularProgress, Button, Alert, Divider, Snackbar } from "@mui/material";
import type { AlertColor } from "@mui/material";
import { CalendarMonth, Sync, CheckCircle, Warning, Schedule, LocationOn, SportsScore } from "@mui/icons-material";
import Link from "next/link";

type SyncStatus = "APPROVED" | "PENDING" | "REJECTED" | "REMOVED" | "NONE";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
  schoolId: string;
  schoolName: string;
  athleticDirectorName: string;
  confirmed: boolean;
  active: boolean;
  syncedAt: string | null;
  syncStatus: SyncStatus;
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
  homeTeam: {
    id: string;
    name: string;
    sport: { name: string } | null;
    level: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
  } | null;
  venue: {
    name: string;
    address: string | null;
  } | null;
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
  upcomingGames: GameData[];
  calendarConnected: boolean;
  calendarSynced: boolean;
  syncRequests: SyncRequest[];
}

async function fetchParentOverview(): Promise<ParentOverviewData> {
  const res = await fetch("/api/parent/overview");
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

async function requestReSync(payload: { schoolId: string; sportName: string; sportLevel: string }): Promise<void> {
  const res = await fetch("/api/parent/calendar-sync-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send request");
}

function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatGameTime(dateStr: string, time: string | null): string {
  if (time) return time;
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type SnackbarState = { open: boolean; message: string; severity: AlertColor };
const DEFAULT_SNACKBAR: SnackbarState = { open: false, message: "", severity: "success" };

export default function ParentDashboardPage() {
  const queryClient = useQueryClient();
  const [resyncLoading, setResyncLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

  const handleRequestResync = async (link: ParentLink) => {
    if (!link.sportName || !link.schoolId) return;
    setResyncLoading(link.id);
    try {
      const res = await fetch("/api/parent/calendar-sync-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: link.schoolId,
          sportName: link.sportName,
          sportLevel: link.sportLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      setSnackbar({ open: true, message: "Re-sync request submitted! The Athletic Director will review it.", severity: "success" });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: "error" });
    } finally {
      setResyncLoading(null);
    }
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

  const subscriptionStatus = data?.subscription?.status || "TRIALING";
  const isOnTrial = subscriptionStatus === "TRIALING";
  const trialEnd = data?.subscription?.trialEnd ? new Date(data.subscription.trialEnd).toLocaleDateString() : null;
  const upcomingGames = data?.upcomingGames || [];
  const syncRequests = data?.syncRequests || [];

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

      {/* Subscription Status Banner */}
      {isOnTrial && trialEnd && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Your free trial ends on {trialEnd}. Continue with Parent Power for $2.25/month to keep calendar sync.
        </Alert>
      )}

      {/* Revoked / Pending re-sync banners */}
      <RevokedSyncBanners
        syncRequests={syncRequests}
        onSuccess={(msg) => setSnackbar({ open: true, message: msg, severity: "success" })}
        onError={(msg) => setSnackbar({ open: true, message: msg, severity: "error" })}
      />

      {/* Upcoming Schedule - Primary Section */}
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
                      <Typography variant="caption" color="text.secondary">
                        {formatGameTime(game.date, game.time)}
                      </Typography>
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
            <Typography variant="body1" color="text.secondary">
              No upcoming games scheduled
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Games will appear here once your child&apos;s coach adds them to the schedule
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <CalendarMonth sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
              <Typography variant="h4" fontWeight={700}>
                {data?.links?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Connected Sports
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Sync sx={{ fontSize: 40, color: data?.calendarConnected ? "success.main" : "primary.main", mb: 1 }} />
              <Typography variant="h4" fontWeight={700}>
                {data?.calendarConnected ? "Active" : "iCal"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calendar Subscription
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Schedule sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
              <Typography variant="h4" fontWeight={700}>
                {upcomingGames.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upcoming Games
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <CheckCircle sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
              <Typography variant="h4" fontWeight={700}>
                Active
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Membership Status
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Connected Sports */}
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        Your Connected Sports
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {data?.links?.map((link) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={link.id}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                  <Typography variant="h6" fontWeight={600}>
                    {link.sportName}
                  </Typography>
                  <Chip label={link.sportLevel} size="small" color="primary" variant="outlined" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {link.schoolName}
                </Typography>
                <Typography variant="body2">
                  <strong>Child:</strong> {link.childName}
                  {link.childGrade && ` (Grade ${link.childGrade})`}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
                  {link.syncStatus === "APPROVED" && <Chip icon={<CheckCircle />} label="Synced" size="small" color="success" variant="outlined" />}
                  {link.syncStatus === "PENDING" && <Chip icon={<Schedule />} label="Sync Pending" size="small" color="warning" variant="outlined" />}
                  {(link.syncStatus === "REMOVED" || link.syncStatus === "REJECTED" || link.syncStatus === "NONE") && link.sportName && (
                    <>
                      <Chip icon={<Warning />} label={link.syncStatus === "REMOVED" ? "Sync Removed" : "Needs Sync"} size="small" color="warning" variant="outlined" />
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={resyncLoading === link.id ? <CircularProgress size={12} /> : <Sync />}
                        disabled={resyncLoading === link.id}
                        onClick={() => handleRequestResync(link)}
                        sx={{ py: 0.25, px: 1, fontSize: "0.7rem" }}
                      >
                        Request Re-sync
                      </Button>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
