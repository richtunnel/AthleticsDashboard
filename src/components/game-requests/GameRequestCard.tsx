"use client";

import { useState } from "react";
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Button,
  Divider, Stack, CircularProgress, Tooltip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import HomeIcon    from "@mui/icons-material/Home";
import FlightIcon  from "@mui/icons-material/FlightTakeoff";
import PlaceIcon   from "@mui/icons-material/Place";
import EmailIcon   from "@mui/icons-material/Email";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatGameDate, formatGameTime, gameRequestSubject, sportComboLabel } from "@/lib/utils/formatGameDateTime";
import { GameConfirmedMessage } from "./GameConfirmedMessage";
import { SyncToScheduleDropdown } from "./SyncToScheduleDropdown";

export interface GameRequestData {
  id:                   string;
  schedulePostId:       string;
  requesterUserId:      string;
  ownerUserId:          string;
  availableDate:        string;
  availableTimeWindow:  string | null;
  sport:                string;
  level:                string;
  gender:               string;
  isHomeForRequester:   boolean;
  status:               "PENDING" | "APPROVED" | "REJECTED" | "CONFIRMED" | "CANCELLED";
  confirmedByOwner:     boolean;
  confirmedByRequester: boolean;
  syncedGameId:         string | null;
  readByOwner:          boolean;
  readByRequester:      boolean;
  timezone:             string;
  requester: {
    id:            string;
    name:          string | null;
    email:         string;
    schoolName:    string | null;
    teamName:      string | null;
    schoolAddress?: string | null;
  };
  owner: {
    id:         string;
    name:       string | null;
    email:      string;
    schoolName: string | null;
    teamName:   string | null;
  };
}

interface Props {
  request:       GameRequestData;
  currentUserId: string;
}

const STATUS_COLORS: Record<string, "warning" | "success" | "error" | "default"> = {
  PENDING:   "warning",
  APPROVED:  "success",
  CONFIRMED: "success",
  REJECTED:  "error",
  CANCELLED: "default",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pending",
  APPROVED:  "Approved",
  CONFIRMED: "Confirmed",
  REJECTED:  "Declined",
  CANCELLED: "Cancelled",
};

export function GameRequestCard({ request, currentUserId }: Props) {
  const theme               = useTheme();
  const isDark              = theme.palette.mode === "dark";
  const queryClient         = useQueryClient();
  const { addNotification } = useNotifications();
  const [confirmed, setConfirmed] = useState(false);

  const isOwner     = request.ownerUserId     === currentUserId;
  const isRequester = request.requesterUserId === currentUserId;

  const tz = request.timezone || "America/New_York";

  // Workbooks query for SyncToScheduleDropdown (only needed when status=CONFIRMED + requester)
  const { data: workbooksData } = useQuery({
    queryKey: ["workbooks"],
    queryFn:  () =>
      fetch("/api/games-workbooks").then((r) => r.json()) as Promise<{ data: { id: string; name: string }[] }>,
    enabled:  isRequester && request.status === "CONFIRMED",
    staleTime: 60_000,
  });

  const mutate = (action: "approve" | "reject" | "confirm" | "cancel") =>
    useMutation({
      mutationFn: () =>
        fetch(`/api/game-requests/${request.id}/${action}`, { method: "PUT" }).then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Action failed");
          return d;
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["game-requests"] });
        queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
        if (action === "confirm") setConfirmed(true);
      },
      onError: (err: Error) => addNotification(err.message, "error"),
    });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const approveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/game-requests/${request.id}/approve`, { method: "PUT" }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
      queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rejectMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/game-requests/${request.id}/reject`, { method: "PUT" }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
      queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const confirmMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/game-requests/${request.id}/confirm`, { method: "PUT" }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      setConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
      queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/game-requests/${request.id}/cancel`, { method: "PUT" }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const requester = request.requester;
  const showAddress = ["APPROVED", "CONFIRMED", "CANCELLED"].includes(request.status);

  const subjectLine = gameRequestSubject(
    requester.schoolName || requester.name || "Another AD",
    request.availableDate,
    tz
  );

  const dateLabel = formatGameDate(request.availableDate, tz);
  const timeLabel = formatGameTime(request.availableTimeWindow, tz);

  const initials = (name: string | null) =>
    (name || "AD")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <Card
      elevation={0}
      sx={{
        border:       "1px solid",
        borderColor:  "divider",
        borderRadius: 3,
        mb:           2,
        overflow:     "hidden",
        transition:   "box-shadow 0.2s ease",
        "&:hover": { boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.08)" },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Subject line */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, fontStyle: "italic", fontSize: "0.8rem" }}
        >
          {subjectLine}
        </Typography>

        {/* Requester info */}
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", fontSize: "0.875rem" }}>
            {initials(requester.name)}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>
              {requester.name || "Athletic Director"}
              {requester.teamName ? (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                  · {requester.schoolName} {requester.teamName}
                </Typography>
              ) : requester.schoolName ? (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                  · {requester.schoolName}
                </Typography>
              ) : null}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <EmailIcon sx={{ fontSize: 12, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                {requester.email}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2, borderColor: "divider", borderBottomWidth: "0.5px" }} />

        {/* Date/time block — center of attraction */}
        <Box
          sx={{
            textAlign:   "center",
            py:          2.5,
            px:          2,
            mb:          2,
            borderRadius: 2,
            bgcolor:     alpha(theme.palette.primary.main, isDark ? 0.15 : 0.07),
            border:      "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.2),
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: "1rem", sm: "1.125rem" } }}>
            {dateLabel}
          </Typography>
          <Typography
            variant="h4"
            fontWeight={800}
            color="primary"
            sx={{ mt: 0.5, fontSize: { xs: "1.75rem", sm: "2rem" } }}
          >
            {timeLabel}
          </Typography>
        </Box>

        {/* Details rows */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {/* Home / Away */}
          <Stack direction="row" alignItems="center" gap={1}>
            {request.isHomeForRequester ? (
              <HomeIcon fontSize="small" color="action" />
            ) : (
              <FlightIcon fontSize="small" color="action" />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
              Home / Away:
            </Typography>
            <Chip
              size="small"
              label={request.isHomeForRequester ? "Home" : "Away"}
              color={request.isHomeForRequester ? "primary" : "default"}
              variant="outlined"
            />
          </Stack>

          {/* Sport combo */}
          <Stack direction="row" alignItems="center" gap={1}>
            <SportsSoccerIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
              Sport:
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {sportComboLabel(request.sport, request.level, request.gender)}
            </Typography>
          </Stack>

          {/* Address — only after approval */}
          {showAddress && requester.schoolAddress && (
            <Stack direction="row" alignItems="flex-start" gap={1}>
              <PlaceIcon fontSize="small" color="action" sx={{ mt: 0.25 }} />
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                Address:
              </Typography>
              <Typography variant="body2">{requester.schoolAddress}</Typography>
            </Stack>
          )}
        </Stack>

        <Divider sx={{ mb: 2, borderColor: "divider", borderBottomWidth: "0.5px" }} />

        {/* Action area */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1}
        >
          {/* Actions based on role + status */}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {/* Owner actions */}
            {isOwner && request.status === "PENDING" && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  disabled={approveMutation.isPending}
                  startIcon={approveMutation.isPending ? <CircularProgress size={12} color="inherit" /> : undefined}
                  onClick={() => approveMutation.mutate()}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                  sx={{ textTransform: "none" }}
                >
                  Decline
                </Button>
              </>
            )}

            {isOwner && request.status === "APPROVED" && (
              <Chip label="Awaiting requester confirmation…" size="small" variant="outlined" color="info" />
            )}

            {/* Requester actions */}
            {isRequester && request.status === "PENDING" && (
              <Chip label="Request sent — awaiting response" size="small" variant="outlined" color="default" />
            )}

            {isRequester && request.status === "APPROVED" && !confirmed && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  disabled={confirmMutation.isPending}
                  startIcon={confirmMutation.isPending ? <CircularProgress size={12} color="inherit" /> : undefined}
                  onClick={() => confirmMutation.mutate()}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Confirm Game
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                  sx={{ textTransform: "none" }}
                >
                  Cancel
                </Button>
              </>
            )}

            {isRequester && (request.status === "CONFIRMED" || confirmed) && (
              <>
                {confirmed && <GameConfirmedMessage />}
                {!request.syncedGameId ? (
                  <SyncToScheduleDropdown
                    requestId={request.id}
                    workbooks={workbooksData?.data}
                  />
                ) : (
                  <Chip label="Synced to Schedule ✓" size="small" color="success" variant="outlined" />
                )}
              </>
            )}

            {request.status === "REJECTED"  && <Chip label="Declined" size="small" color="error"   variant="outlined" />}
            {request.status === "CANCELLED" && <Chip label="Cancelled" size="small" color="default" variant="outlined" />}
          </Stack>

          {/* Status chip — always shown */}
          <Chip
            label={STATUS_LABELS[request.status] ?? request.status}
            color={STATUS_COLORS[request.status] ?? "default"}
            size="small"
            variant="filled"
            sx={{ fontWeight: 700, fontSize: "0.7rem" }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
