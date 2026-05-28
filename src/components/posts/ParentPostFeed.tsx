"use client";

import { useEffect, useRef } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import ParentPostCard, { type ParentPostData } from "./ParentPostCard";

interface ParentPostFeedProps {
  currentParentId: string;
  queryKey: string;
}

export default function ParentPostFeed({ currentParentId, queryKey }: ParentPostFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: [queryKey],
      queryFn: async ({ pageParam }: { pageParam: string | null }) => {
        const url = `/api/parent/posts${pageParam ? `?cursor=${pageParam}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load posts");
        return res.json() as Promise<{ data: ParentPostData[]; nextCursor: string | null }>;
      },
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
    });

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Typography color="error" textAlign="center" sx={{ py: 6 }}>
        Failed to load posts. Please refresh and try again.
      </Typography>
    );
  }

  if (posts.length === 0) {
    return (
      // Centered both horizontally and vertically within the viewport.
      // minHeight uses dvh-with-fallback-to-vh so phones with dynamic UI
      // chrome don't squash the centering.
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: { xs: "60vh", md: "70vh" },
          px: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600} gutterBottom>
          No posts yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Posts from your school&apos;s athletic director will appear here.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <ParentPostCard key={post.id} post={post} currentParentId={currentParentId} />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!hasNextPage && posts.length > 0 && (
        <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ display: "block", py: 3 }}>
          You're all caught up
        </Typography>
      )}
    </>
  );
}
