"use client";

import { useState } from "react";
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Typography, Chip, Avatar, Button,
  Tooltip, Stack, Skeleton,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LockIcon          from "@mui/icons-material/Lock";
import { useQuery }      from "@tanstack/react-query";
import { useSession }    from "next-auth/react";
import { formatGameDateShort, formatDayOfWeek, sportComboLabel, genderLabel } from "@/lib/utils/formatGameDateTime";
import { CheckAvailabilityModal } from "./CheckAvailabilityModal";

interface AvailableDate {
  date:       string;
  dayOfWeek:  string;
  timeWindow: string | null;
}

interface Post {
  id:             string;
  sport:          string;
  level:          string;
  gender:         string;
  seasonStart:    string;
  seasonEnd:      string;
  postedAt:       string;
  timezone:       string;
  isOwnPost:      boolean;
  owner: {
    id:         string;
    name:       string | null;
    schoolName: string | null;
    teamName:   string | null;
    city:       string | null;
  };
  availableDates: AvailableDate[];
}

interface Props {
  sportFilter:  { sport: string; level: string; gender: string } | null;
  schoolFilter: string | null;
}

export function ScheduleBoardTable({ sportFilter, schoolFilter }: Props) {
  const theme                 = useTheme();
  const isDark                = theme.palette.mode === "dark";
  const { data: session, status: sessionStatus } = useSession();
  const [modal, setModal]     = useState<{ post: Post; date: string } | null>(null);

  const params = new URLSearchParams();
  if (sportFilter?.sport)  params.set("sport",    sportFilter.sport);
  if (sportFilter?.level)  params.set("level",    sportFilter.level);
  if (sportFilter?.gender) params.set("gender",   sportFilter.gender);
  if (schoolFilter)        params.set("schoolId", schoolFilter);

  const { data, isLoading } = useQuery({
    queryKey:        ["schedule-board", sportFilter, schoolFilter],
    queryFn:         () =>
      fetch(`/api/schedule-board?${params.toString()}`).then((r) => r.json()) as Promise<{
        posts: Post[];
        total: number;
      }>,
    refetchInterval: 30_000,
    staleTime:       20_000,
  });

  const posts = data?.posts ?? [];

  // Flatten posts × dates into rows
  const rows = posts.flatMap((post) =>
    post.availableDates.map((d) => ({ post, date: d }))
  );

  const headerBg = isDark ? theme.palette.primary.dark : theme.palette.primary.main;

  return (
    <>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", overflowX: "auto" }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {["Date", "Day", "Time", "Sport", "School", ""].map((h) => (
                <TableCell
                  key={h}
                  sx={{
                    "&&": { backgroundColor: headerBg },
                    color:         "#fff",
                    fontWeight:    700,
                    fontSize:      "0.75rem",
                    whiteSpace:    "nowrap",
                    letterSpacing: 0.5,
                    borderBottom:  "none",
                    py:            1.25,
                  }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton height={24} /></TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                      <CalendarTodayIcon sx={{ fontSize: 36, mb: 1, display: "block", mx: "auto", opacity: 0.3 }} />
                      <Typography variant="body2">
                        No open dates found.{" "}
                        {sportFilter || schoolFilter ? "Try clearing your filters." : "Check back soon as ADs post their availability."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              : rows.map(({ post, date }, idx) => (
                  <TableRow
                    key={`${post.id}-${date.date}`}
                    sx={{
                      bgcolor: idx % 2 === 0
                        ? "transparent"
                        : isDark
                        ? alpha(theme.palette.action.hover, 0.04)
                        : alpha(theme.palette.action.hover, 0.03),
                      "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                    }}
                  >
                    {/* Date */}
                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap", py: 1.25 }}>
                      {formatGameDateShort(date.date, post.timezone)}
                    </TableCell>

                    {/* Day */}
                    <TableCell sx={{ color: "text.secondary", py: 1.25 }}>
                      {formatDayOfWeek(date.date, post.timezone)}
                    </TableCell>

                    {/* Time */}
                    <TableCell sx={{ color: "text.secondary", py: 1.25 }}>
                      {date.timeWindow ?? (
                        <Typography component="span" variant="caption" color="text.disabled">
                          Time TBD
                        </Typography>
                      )}
                    </TableCell>

                    {/* Sport */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        <Chip label={post.sport}  size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                        <Chip label={post.level}  size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                        <Chip label={genderLabel(post.gender)} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
                      </Stack>
                    </TableCell>

                    {/* School */}
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 26, height: 26, fontSize: "0.65rem", bgcolor: "primary.main" }}>
                          {(post.owner.schoolName || post.owner.name || "AD")[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600} lineHeight={1.2} sx={{ fontSize: "0.8rem" }}>
                            {post.owner.schoolName || post.owner.name}
                            {post.owner.teamName ? (
                              <Typography component="span" variant="caption" color="text.secondary">
                                {" "}({post.owner.teamName})
                              </Typography>
                            ) : null}
                          </Typography>
                          {post.owner.city && (
                            <Typography variant="caption" color="text.secondary">
                              {post.owner.city}
                            </Typography>
                          )}
                        </Box>
                        {post.isOwnPost && (
                          <Chip label="Your Post" size="small" color="primary" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                        )}
                      </Stack>
                    </TableCell>

                    {/* Action */}
                    <TableCell align="right" sx={{ py: 1.25, pr: 2 }}>
                      {post.isOwnPost ? null : sessionStatus === "loading" ? (
                        <Skeleton variant="rounded" width={130} height={28} />
                      ) : !session ? (
                        <Tooltip title="Sign in to request a game">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled
                              startIcon={<LockIcon fontSize="small" />}
                              sx={{ textTransform: "none", fontSize: "0.75rem" }}
                            >
                              Check Availability
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => setModal({ post, date: date.date })}
                          sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap" }}
                        >
                          Check Availability
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </TableContainer>

      {modal && (
        <CheckAvailabilityModal
          open
          onClose={() => setModal(null)}
          schedulePostId={modal.post.id}
          availableDate={modal.date}
          timezone={modal.post.timezone}
          schoolName={modal.post.owner.schoolName}
          sport={modal.post.sport}
          level={modal.post.level}
          gender={modal.post.gender}
        />
      )}
    </>
  );
}
