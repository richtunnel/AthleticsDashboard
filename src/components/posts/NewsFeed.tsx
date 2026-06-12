"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Box, CircularProgress, Skeleton, Typography } from "@mui/material";
import PostCard, { type PostData } from "./PostCard";

interface FeedPage {
  success: boolean;
  data: PostData[];
  nextCursor: string | null;
}

async function fetchPosts(cursor?: string): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: "12" });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/posts?${params}`);
  if (!res.ok) throw new Error("Failed to load posts");
  return res.json();
}

function PostSkeleton() {
  return (
    <Box sx={{ mb: 2, p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <Skeleton variant="circular" width={44} height={44} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="40%" height={20} />
          <Skeleton variant="text" width="25%" height={16} />
        </Box>
      </Box>
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="85%" />
      <Skeleton variant="text" width="60%" />
    </Box>
  );
}

interface NewsFeedProps {
  currentUserId?: string;
  queryKey?: string;
  /**
   * Number of columns to lay the posts out in. Defaults to 1 (single feed
   * column, used by the public /news page). The dashboard Community page passes
   * 3 to show posts in rows of three. Degrades responsively on smaller screens.
   */
  columns?: number;
}

export default function NewsFeed({ currentUserId, queryKey = "posts-feed", columns = 1 }: NewsFeedProps) {
  const { data: session } = useSession();
  const resolvedUserId = currentUserId ?? session?.user?.id;
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery<FeedPage>({
      queryKey: [queryKey],
      queryFn: ({ pageParam }) => fetchPosts(pageParam as string | undefined),
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialPageParam: undefined,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    });

  // Expose a way to prepend a newly created post without a full refetch
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }, [queryClient, queryKey]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleDelete = async (postId: string) => {
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) invalidate();
  };

  const allPosts = data?.pages.flatMap((p) => p.data) ?? [];

  // Multi-column grid for the dashboard (columns > 1); single column elsewhere.
  // Responsive: 1 col on mobile, 2 on tablet, up to `columns` on desktop.
  const gridSx =
    columns > 1
      ? {
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: `repeat(${columns}, minmax(0, 1fr))`,
          },
          gap: 2,
          alignItems: "start",
        }
      : undefined;

  if (isLoading) {
    return (
      <Box sx={gridSx}>
        {[...Array(columns > 1 ? columns : 3)].map((_, i) => <PostSkeleton key={i} />)}
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <Typography color="text.secondary" gutterBottom>
          Could not load posts.
        </Typography>
        <Typography
          component="span"
          variant="body2"
          onClick={() => refetch()}
          sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
        >
          Try again
        </Typography>
      </Box>
    );
  }

  if (allPosts.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 400 }}>
          No posts yet
        </Typography>
        <Typography variant="body2">
          Be the first to share an update with the community.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={gridSx}>
        {allPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={resolvedUserId}
            onDelete={handleDelete}
          />
        ))}
      </Box>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} />

      {isFetchingNextPage && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!hasNextPage && allPosts.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", py: 3 }}>
          You&apos;ve reached the end
        </Typography>
      )}
    </Box>
  );
}

export { type NewsFeedProps };
