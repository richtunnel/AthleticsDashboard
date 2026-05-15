"use client";

import { useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Box, CircularProgress, Skeleton, Typography } from "@mui/material";
import { AnnouncementCard, type AnnouncementData } from "./AnnouncementCard";

interface FeedPage {
  success: boolean;
  data: AnnouncementData[];
  nextCursor: string | null;
}

async function fetchAnnouncements(apiPath: string, cursor?: string): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: "12" });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`${apiPath}?${params}`);
  if (!res.ok) throw new Error("Failed to load announcements");
  return res.json();
}

function AnnouncementSkeleton() {
  return (
    <Box sx={{ mb: 2, p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
        <Skeleton variant="circular" width={36} height={36} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="35%" height={18} />
          <Skeleton variant="text" width="20%" height={14} />
        </Box>
      </Box>
      <Skeleton variant="text" width="60%" height={22} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="70%" />
    </Box>
  );
}

interface AnnouncementFeedProps {
  currentUserId?: string;
  queryKey?: string;
  /** API endpoint to fetch from — defaults to /api/announcements (AD view) */
  apiPath?: string;
  showSchool?: boolean;
}

export default function AnnouncementFeed({
  currentUserId,
  queryKey = "announcements-feed",
  apiPath = "/api/announcements",
  showSchool = false,
}: AnnouncementFeedProps) {
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery<FeedPage>({
      queryKey: [queryKey],
      queryFn: ({ pageParam }) => fetchAnnouncements(apiPath, pageParam as string | undefined),
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialPageParam: undefined,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }, [queryClient, queryKey]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allItems = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return <Box>{[...Array(3)].map((_, i) => <AnnouncementSkeleton key={i} />)}</Box>;
  }

  if (isError || allItems.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 400 }}>
          No Announcements
        </Typography>
        {!isError && (
          <Typography variant="body2">
            Post an announcement above to notify connected parents of important updates.
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {allItems.map((item) => (
        <AnnouncementCard
          key={item.id}
          announcement={item}
          currentUserId={currentUserId}
          showSchool={showSchool}
          onDelete={(id) => {
            queryClient.setQueryData([queryKey], (old: any) => ({
              ...old,
              pages: old.pages.map((page: FeedPage) => ({
                ...page,
                data: page.data.filter((a) => a.id !== id),
              })),
            }));
          }}
          onUpdated={(updated) => {
            queryClient.setQueryData([queryKey], (old: any) => ({
              ...old,
              pages: old.pages.map((page: FeedPage) => ({
                ...page,
                data: page.data.map((a) => (a.id === updated.id ? updated : a)),
              })),
            }));
          }}
        />
      ))}

      <div ref={sentinelRef} />

      {isFetchingNextPage && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!hasNextPage && allItems.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", py: 3 }}>
          You&apos;ve reached the end
        </Typography>
      )}
    </Box>
  );
}

export type { AnnouncementFeedProps };
