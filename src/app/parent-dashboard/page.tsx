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
  Tooltip,
  Snackbar,
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
} from "@mui/icons-material";
import Link from "next/link";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
  schoolId: string;
  schoolName: string;
  athleticDirectorId: string | null;
  athleticDirectorName: string | null;
  calendarSynced: boolean;
  syncRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  confirmed?: boolean;
  active?: boolean;
  syncedAt?: string | null;
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
  monthlyRequestCount: number;
  monthlyRequestLimit: number;
}

async function fetchParentOverview(): Promise<ParentOverviewData> {
  const res = await fetch("/api/parent/overview");
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
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

export default function ParentDashboardPage() {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false, message: "", severity: "success",
  });
  const [syncingLinkId, setSyncingLinkId] = useState<string | null>(null);

  const showSnack = (message: string, severity: AlertColor = "success") =>
    setSnackbar({ open: true, message, severity });

  const syncRequestMutation = useMutation({
    mutationFn: async (link: ParentLink) => {
      const res = await fetch("/api/parent/calendar-sync-request-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkId: link.id,
          schoolId: link.schoolId,
          sportName: link.sportName,
          sportLevel: link.sportLevel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.error || "Request failed"), json);
      return json;
    },
    onSuccess: (_, link) => {
      queryClient.invalidateQueries({ queryKey: ["parentOverview"] });
      showSnack(
        `Calendar sync request sent to ${link.athleticDirectorName ?? "the Athletic Director"}! They'll receive an email and chat notification.`,
        "success"
      );
    },
    onError: (err: any, link) => {
      setSyncingLinkId(null);
      if (err.limitReached) {
        showSnack(err.message, "warning");
      } else if (err.alreadyRequested) {
        showSnack(err.message, "info");
      } else {
        showSnack(err.message || "Failed to send sync request", "error");
      }
    },
    onSettled: () => setSyncingLinkId(null),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

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
                        {game.isHome
                          ? `vs ${game.awayTeam?.name || "TBD"}`
                          : `at ${game.awayTeam?.name || "TBD"}`}
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          Your Connected Sports
        </Typography>
        {(data?.monthlyRequestCount ?? 0) > 0 && (
          <Typography variant="caption" color="text.secondary">
            Sync requests this month: {data?.monthlyRequestCount}/{data?.monthlyRequestLimit}
          </Typography>
        )}
      </Box>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {data?.links?.map((link) => {
          const isSynced = link.calendarSynced;
          const hasPendingRequest = link.syncRequestStatus === "PENDING" || link.syncRequestStatus === "APPROVED";
          const limitReached = (data?.monthlyRequestCount ?? 0) >= (data?.monthlyRequestLimit ?? 5);
          const isSendingThis = syncingLinkId === link.id && syncRequestMutation.isPending;

          const syncDisabled = isSynced || hasPendingRequest || limitReached || syncRequestMutation.isPending;

          let syncTooltip = "Request calendar sync with Athletic Director";
          if (isSynced) syncTooltip = "Calendar is already synced";
          else if (link.syncRequestStatus === "PENDING") syncTooltip = "Sync request is pending AD approval";
          else if (link.syncRequestStatus === "APPROVED") syncTooltip = "Sync has been approved";
          else if (limitReached) syncTooltip = `Monthly limit of ${data?.monthlyRequestLimit} requests reached. Resets on the 1st.`;

          return (
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

                  {/* Status + sync button row */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {isSynced ? (
                        <Chip icon={<CheckCircle />} label="Synced" size="small" color="success" variant="outlined" />
                      ) : link.syncRequestStatus === "PENDING" ? (
                        <Chip icon={<Warning />} label="Request Pending" size="small" color="warning" variant="outlined" />
                      ) : link.syncRequestStatus === "APPROVED" ? (
                        <Chip icon={<CheckCircle />} label="Approved" size="small" color="info" variant="outlined" />
                      ) : (
                        <Chip icon={<Warning />} label="Not Synced" size="small" color="default" variant="outlined" />
                      )}
                    </Box>

                    <Tooltip title={syncTooltip} arrow>
                      <span>
                        <Button
                          size="small"
                          variant={isSynced || hasPendingRequest ? "outlined" : "contained"}
                          color={isSynced ? "success" : "primary"}
                          disabled={syncDisabled}
                          startIcon={isSendingThis ? <CircularProgress size={14} color="inherit" /> : <Sync fontSize="small" />}
                          onClick={() => {
                            setSyncingLinkId(link.id);
                            syncRequestMutation.mutate(link);
                          }}
                          sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                        >
                          {isSendingThis
                            ? "Sending…"
                            : isSynced
                            ? "Synced ✓"
                            : hasPendingRequest
                            ? "Requested"
                            : "Sync Calendar"}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
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

      {/* Feedback snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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
    </Box>
  );
}
