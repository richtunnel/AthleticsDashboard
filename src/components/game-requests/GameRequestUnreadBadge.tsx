"use client";

import { Badge } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

interface Props {
  /** Wrap children with the badge */
  children?: React.ReactNode;
}

export function GameRequestUnreadBadge({ children }: Props) {
  const { data } = useQuery({
    queryKey: ["game-requests-unread"],
    queryFn:  () =>
      fetch("/api/game-requests/unread-count").then((r) => r.json()) as Promise<{ count: number }>,
    refetchInterval: 30_000,
    staleTime:       15_000,
  });

  const count = data?.count ?? 0;

  if (!children) {
    if (!count) return null;
    return (
      <Badge
        badgeContent={count}
        color="error"
        sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", minWidth: 16, height: 16 } }}
      />
    );
  }

  return (
    <Badge
      badgeContent={count || undefined}
      color="error"
      sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", minWidth: 16, height: 16 } }}
    >
      {children}
    </Badge>
  );
}
