"use client";

import { useState, useEffect } from "react";
import {
  Box, Typography, Stack, Divider, Button,
  Grid, CircularProgress, FormControl, InputLabel,
  Select, MenuItem, Pagination, Alert, Link as MuiLink,
} from "@mui/material";
import ArrowBackIcon    from "@mui/icons-material/ArrowBack";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import BusinessIcon     from "@mui/icons-material/Business";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScheduleBoardCard }    from "@/components/schedule-board/ScheduleBoardCard";
import { SchoolSearchBar }      from "@/components/schedule-board/SchoolSearchBar";


interface School {
  userId:     string;
  name:       string | null;
  schoolName: string | null;
  teamName:   string | null;
  city:       string | null;
  district:   string | null;
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

interface Pagination {
  total:      number;
  page:       number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

interface ApiResponse {
  schools:            School[];
  pagination:         Pagination;
  userDistrict:       string | null;
  availableDistricts: string[];
}

const PROMPT_DISMISSED_KEY = "schedule-board-district-prompt-dismissed";

export default function ScheduleBoardPage() {
  const [schoolFilter,      setSchoolFilter]       = useState<string | null>(null);
  const [districtFilter,    setDistrictFilter]     = useState<string>(""); // "" = use API default
  const [page,              setPage]               = useState(1);
  const [promptDismissed,   setPromptDismissed]    = useState(true); // start hidden to avoid flash
  const [districtInitialized, setDistrictInitialized] = useState(false);

  // Read dismiss state from localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY) === "true";
    setPromptDismissed(dismissed);
  }, []);

  const params = new URLSearchParams();
  if (schoolFilter)                                    params.set("schoolId", schoolFilter);
  if (districtFilter && districtFilter !== "")         params.set("district", districtFilter);
  params.set("page",  String(page));
  params.set("limit", "20");

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey:        ["schedule-board-schools", schoolFilter, districtFilter, page],
    queryFn:         () =>
      fetch(`/api/schedule-board/schools?${params.toString()}`)
        .then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime:       20_000,
  });

  // Once we receive the user's district, set it as the default filter (one-time)
  useEffect(() => {
    if (!districtInitialized && data?.userDistrict) {
      setDistrictFilter(data.userDistrict);
      setDistrictInitialized(true);
    } else if (!districtInitialized && data !== undefined) {
      // Data loaded but no district — mark initialized so we don't loop
      setDistrictInitialized(true);
    }
  }, [data, districtInitialized]);

  const schools: School[] = data?.schools ?? [];

  const pagination         = data?.pagination;
  const userDistrict       = data?.userDistrict ?? null;
  const availableDistricts = data?.availableDistricts ?? [];
  const showNoDistrictPrompt =
    !promptDismissed && data !== undefined && !userDistrict;

  const handleDistrictChange = (value: string) => {
    setDistrictFilter(value);
    setPage(1);
  };

  const handleDismissPrompt = () => {
    setPromptDismissed(true);
    localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
  };

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

      {/* No-district prompt (dismissible) */}
      {showNoDistrictPrompt && (
        <Alert
          severity="info"
          icon={<BusinessIcon fontSize="small" />}
          onClose={handleDismissPrompt}
          sx={{ mb: 2.5 }}
        >
          <Typography variant="body2" fontWeight={600}>
            Add your school district for better results
          </Typography>
          <Typography variant="body2">
            Schools in your district are shown first by default.{" "}
            <MuiLink component={Link} href="/dashboard/settings" underline="always">
              Add it in Settings → School Details
            </MuiLink>
          </Typography>
        </Alert>
      )}

      {/* District filter + Search + Sport filters */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        {/* District selector row */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          gap={2}
        >
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel shrink>District</InputLabel>
            <Select
              displayEmpty
              notched
              value={districtFilter}
              label="District"
              onChange={(e) => handleDistrictChange(e.target.value)}
              renderValue={(v) => {
                if (!v || v === "all") return "All Districts";
                return v === userDistrict ? `${v} (My District)` : v;
              }}
            >
              <MenuItem value="all">All Districts</MenuItem>
              {userDistrict && (
                <MenuItem value={userDistrict}>
                  {userDistrict} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>(My District)</Typography>
                </MenuItem>
              )}
              {availableDistricts
                .filter((d) => d !== userDistrict)
                .map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
            </Select>
          </FormControl>
        </Stack>

        {/* School search + sport filters row */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          gap={2}
        >
          <SchoolSearchBar onSelect={(id) => { setSchoolFilter(id); setPage(1); }} />
        </Stack>
      </Stack>

      {/* School cards */}
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
            {schoolFilter || (districtFilter && districtFilter !== "all")
              ? "Try clearing your filters."
              : "Be the first — head to Posts › Schedule Post to publish your open dates."}
          </Typography>
          {(districtFilter && districtFilter !== "all") && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDistrictChange("all")}
              sx={{ mt: 2, textTransform: "none" }}
            >
              Show All Districts
            </Button>
          )}
          <Button
            component={Link}
            href="/dashboard/posts?tab=2"
            variant="contained"
            size="small"
            sx={{ mt: 2, ml: 1, textTransform: "none", fontWeight: 700 }}
          >
            Post Your Schedule →
          </Button>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {schools.map((school) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={school.userId}>
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

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.page}
                onChange={(_, p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}

          {pagination && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
              Showing {schools.length} of {pagination.total} school{pagination.total !== 1 ? "s" : ""}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
