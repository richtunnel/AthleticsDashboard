"use client";

import { useEffect } from "react";
import { Box, Typography, CircularProgress, Divider } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { GameRequestCard, GameRequestData } from "./GameRequestCard";

interface Props {
  /** Where this panel is rendered — adjusts padding/max-height hints */
  context?: "posts" | "settings" | "games";
  /** Which direction to filter */
  mode?: "received" | "sent" | "all";
}

const SECTION_ORDER = ["PENDING", "APPROVED", "CONFIRMED", "REJECTED", "CANCELLED"] as const;

const SECTION_LABELS: Record<string, string> = {
  PENDING:   "Pending Requests",
  APPROVED:  "Approved — Awaiting Confirmation",
  CONFIRMED: "Confirmed",
  REJECTED:  "Declined",
  CANCELLED: "Cancelled",
};

export function GameRequestsPanel({ context = "posts", mode = "all" }: Props) {
  const { data: session } = useSession();
  const queryClient       = useQueryClient();
  const currentUserId     = session?.user?.id ?? "";

  const type = mode === "all" ? undefined : mode === "received" ? "received" : "sent";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["game-requests", mode],
    queryFn:  () =>
      fetch(`/api/game-requests${type ? `?type=${type}` : ""}`).then((r) => r.json()) as Promise<{
        requests: GameRequestData[];
      }>,
    enabled:       !!currentUserId,
    refetchInterval: 30_000,
    staleTime:     10_000,
  });

  // Mark all pending/unread as read when panel mounts
  useEffect(() => {
    if (!data?.requests?.length) return;
    const unread = data.requests.filter((r) => {
      const isOwner     = r.ownerUserId     === currentUserId;
      const isRequester = r.requesterUserId === currentUserId;
      return (isOwner && !r.readByOwner) || (isRequester && !r.readByRequester);
    });
    unread.forEach((r) => {
      fetch(`/api/game-requests/${r.id}/read`, { method: "PUT" }).catch(() => {});
    });
    if (unread.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
    }
  }, [data?.requests, currentUserId, queryClient]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Typography color="error" sx={{ py: 3, textAlign: "center" }}>
        Failed to load game requests. Please refresh.
      </Typography>
    );
  }

  const requests = data?.requests ?? [];

  if (!requests.length) {
    return (
      <Box
        sx={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          py:             6,
          color:          "text.secondary",
        }}
      >
        <InboxIcon sx={{ fontSize: 48, mb: 1, opacity: 0.35 }} />
        <Typography variant="body2" textAlign="center">
          No game requests yet.
          <br />
          Browse the{" "}
          <a href="/schedule-board" style={{ color: "inherit", textDecoration: "underline" }}>
            Schedule Exchange Board
          </a>{" "}
          to request games from other ADs.
        </Typography>
      </Box>
    );
  }

  // Group by status
  const grouped: Record<string, GameRequestData[]> = {};
  SECTION_ORDER.forEach((s) => (grouped[s] = []));
  requests.forEach((r) => {
    if (grouped[r.status]) grouped[r.status].push(r);
    else grouped["CANCELLED"].push(r);
  });

  return (
    <Box
      sx={{
        maxHeight: context === "settings" ? "70vh" : "none",
        overflowY: context === "settings" ? "auto"  : "visible",
        pr:        context === "settings" ? 0.5     : 0,
      }}
    >
      {SECTION_ORDER.map((status) => {
        const items = grouped[status];
        if (!items.length) return null;

        const isHistory = ["REJECTED", "CANCELLED"].includes(status);

        return (
          <Box key={status} sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{
                color:        isHistory ? "text.disabled" : "text.secondary",
                fontWeight:   700,
                fontSize:     "0.7rem",
                letterSpacing: 1,
                mb:           1,
                display:      "block",
              }}
            >
              {SECTION_LABELS[status]} ({items.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {items.map((r) => (
              <GameRequestCard key={r.id} request={r} currentUserId={currentUserId} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
