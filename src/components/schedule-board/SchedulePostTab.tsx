"use client";

import { Box, Typography, Divider, CircularProgress, Button, Stack } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useQuery } from "@tanstack/react-query";
import { SchedulePostForm }  from "./SchedulePostForm";
import { PostedScheduleCard } from "./PostedScheduleCard";

interface PostedSchedule {
  id:          string;
  sport:       string;
  level:       string;
  gender:      string;
  seasonStart: string;
  seasonEnd:   string;
  isActive:    boolean;
  title:       string | null;
  description: string | null;
  workbook:    { id: string; name: string };
}

export function SchedulePostTab() {
  const { data, isLoading } = useQuery({
    queryKey:  ["schedule-board-mine"],
    queryFn:   () =>
      fetch("/api/schedule-board/mine").then((r) => r.json()) as Promise<{
        posts: PostedSchedule[];
      }>,
    staleTime: 30_000,
  });

  const posts = data?.posts ?? [];

  return (
    <Box>
      {/* Quick link to the Exchange Board */}
      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Button
          component="a"
          href="/schedule-board"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8rem" }}
        >
          View Schedule Exchange Board
        </Button>
      </Stack>

      <SchedulePostForm />

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : posts.length > 0 ? (
        <>
          <Divider sx={{ mb: 2.5 }} />
          <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.7rem", letterSpacing: 1 }}>
            Your Active Posts
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            {posts.map((post) => (
              <PostedScheduleCard key={post.id} post={post} />
            ))}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
