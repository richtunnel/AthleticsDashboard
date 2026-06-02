"use client";

import { useState } from "react";
import {
  Box, Typography, Stack, Divider, Button,
  Grid, CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScheduleBoardCard }    from "@/components/schedule-board/ScheduleBoardCard";
import { ScheduleBoardFilters } from "@/components/schedule-board/ScheduleBoardFilters";
import { SchoolSearchBar }      from "@/components/schedule-board/SchoolSearchBar";

type SportFilter = { sport: string; level: string; gender: string } | null;

interface School {
  userId:     string;
  name:       string | null;
  schoolName: string | null;
  teamName:   string | null;
  city:       string | null;
  timezone:   string;
  isOwnPost:  boolean;
  combos: Array<{
    postId:      string;
    sport:       string;
    level:       string;
    gender:      string;
    label:       string;
    seasonStart: string;
    seasonEnd:   string;
  }>;
}

export default function ScheduleBoardPage() {
  const [sportFilter,  setSportFilter]  = useState<SportFilter>(null);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (schoolFilter) params.set("schoolId", schoolFilter);

  const { data, isLoading } = useQuery({
    queryKey:        ["schedule-board-schools", schoolFilter],
    queryFn:         () =>
      fetch(`/api/schedule-board/schools?${params.toString()}`).then((r) =>
        r.json()
      ) as Promise<{ schools: School[] }>,
    refetchInterval: 30_000,
    staleTime:       20_000,
  });

  // Filter by sport combo client-side (fast, avoids re-fetch)
  const schools: School[] = (data?.schools ?? []).filter((s) => {
    if (!sportFilter) return true;
    return s.combos.some(
      (c) =>
        c.sport  === sportFilter.sport  &&
        c.level  === sportFilter.level  &&
        c.gender === sportFilter.gender
    );
  });

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 1.5, sm: 3 }, py: 3 }}>
      {/* Back link */}
      <Button
        component="a"
        href="/dashboard"
        startIcon={<ArrowBackIcon fontSize="small" />}
        size="small"
        sx={{ mb: 2, textTransform: "none", color: "text.secondary" }}
      >
        Back to Dashboard
      </Button>

      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
        <CalendarTodayIcon color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          Schedule Exchange Board
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Browse open game dates from Athletic Directors across the network. Find a school,
        view their schedule, and request a game directly — no phone tag required.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Search + Filters */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        gap={2}
        sx={{ mb: 3 }}
      >
        <SchoolSearchBar onSelect={setSchoolFilter} />
        <ScheduleBoardFilters selected={sportFilter} onChange={setSportFilter} />
      </Stack>

      {/* School cards grid */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : schools.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <CalendarTodayIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.3 }} />
          <Typography variant="body1" fontWeight={600} gutterBottom>
            No schools posted yet
          </Typography>
          <Typography variant="body2">
            {sportFilter || schoolFilter
              ? "Try clearing your filters."
              : "Be the first — head to Posts › Schedule Post to publish your open dates."}
          </Typography>
          <Button
            component={Link}
            href="/dashboard/posts?tab=2"
            variant="contained"
            size="small"
            sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          >
            Post Your Schedule →
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {schools.map((school) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={school.userId}>
              <ScheduleBoardCard
                userId={school.userId}
                name={school.name}
                schoolName={school.schoolName}
                teamName={school.teamName}
                city={school.city}
                timezone={school.timezone}
                combos={school.combos}
                isOwnPost={school.isOwnPost}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
