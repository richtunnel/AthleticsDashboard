"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, IconButton,
  FormControl, InputLabel, Select, MenuItem,
  Typography, Box, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper,
  Button, Chip, Stack, CircularProgress, Divider,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon        from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { useQuery }      from "@tanstack/react-query";
import {
  formatGameDateShort,
  formatDayOfWeek,
  formatGameTime,
  sportComboLabel,
} from "@/lib/utils/formatGameDateTime";
import { CheckAvailabilityModal } from "./CheckAvailabilityModal";

interface Combo {
  postId:      string;
  sport:       string;
  level:       string;
  gender:      string;
  label:       string;
  seasonStart: string;
  seasonEnd:   string;
}

interface Props {
  open:       boolean;
  onClose:    () => void;
  schoolName: string | null;
  teamName:   string | null;
  ownerName:  string | null;
  city:       string | null;
  combos:     Combo[];
  isOwnPost:  boolean;
}

interface DateRow {
  date:       string;
  dayOfWeek:  string;
  timeWindow: string | null;
}

export function ViewScheduleModal({
  open, onClose,
  schoolName, teamName, ownerName, city,
  combos, isOwnPost,
}: Props) {
  const theme           = useTheme();
  const isDark          = theme.palette.mode === "dark";
  const [selectedPostId, setSelectedPostId] = useState<string>(combos[0]?.postId ?? "");
  const [checkModal,     setCheckModal]     = useState<{ date: string } | null>(null);

  const selectedCombo = combos.find((c) => c.postId === selectedPostId) ?? combos[0];

  const { data: datesData, isLoading: loadingDates } = useQuery({
    queryKey:  ["schedule-board-dates", selectedPostId],
    queryFn:   () =>
      fetch(`/api/schedule-board/${selectedPostId}/dates`).then((r) => r.json()) as Promise<{
        postId:         string;
        sport:          string;
        level:          string;
        gender:         string;
        timezone:       string;
        availableDates: DateRow[];
      }>,
    enabled:   !!selectedPostId,
    staleTime: 60_000,
  });

  const tz          = datesData?.timezone ?? "America/New_York";
  const dates       = datesData?.availableDates ?? [];
  const showActions = !isOwnPost;

  const headerBg = isDark ? theme.palette.primary.dark : theme.palette.primary.main;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh" } }}
      >
        {/* Header */}
        <DialogTitle sx={{ pb: 1, pr: 6 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <CalendarTodayIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                {schoolName || ownerName || "Schedule"}
                {teamName && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
                    · {teamName}
                  </Typography>
                )}
              </Typography>
              {city && (
                <Typography variant="caption" color="text.secondary">
                  {city}
                </Typography>
              )}
            </Box>
          </Stack>

          <IconButton
            onClick={onClose}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 2.5 }}>
          {/* Sport / Level / Gender picker */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Choose a sport to see {schoolName || "this school"}'s available game dates.
          </Typography>

          <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
            <InputLabel>Sport · Level · Gender</InputLabel>
            <Select
              value={selectedPostId}
              label="Sport · Level · Gender"
              onChange={(e) => setSelectedPostId(e.target.value)}
            >
              {combos.map((c) => (
                <MenuItem key={c.postId} value={c.postId}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Available dates table */}
          {selectedCombo && (
            <>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Open Dates — {sportComboLabel(selectedCombo.sport, selectedCombo.level, selectedCombo.gender)}
                </Typography>
                {!loadingDates && (
                  <Chip
                    label={`${dates.length} open date${dates.length !== 1 ? "s" : ""}`}
                    size="small"
                    color={dates.length > 0 ? "success" : "default"}
                    variant="outlined"
                  />
                )}
              </Stack>

              {loadingDates ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : dates.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                  <CalendarTodayIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                  <Typography variant="body2">
                    No open dates available for this sport right now.
                  </Typography>
                </Box>
              ) : (
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    overflowX: "auto",
                    maxHeight: 420,
                    overflowY: "auto",
                  }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {["Date", "Day", "Time", ...(showActions ? [""] : [])].map((h) => (
                          <TableCell
                            key={h}
                            sx={{
                              bgcolor:      headerBg,
                              color:        "#fff",
                              fontWeight:   700,
                              fontSize:     "0.72rem",
                              letterSpacing: 0.5,
                              borderBottom: "none",
                              py:           1.25,
                              whiteSpace:   "nowrap",
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {dates.map((d, idx) => (
                        <TableRow
                          key={d.date}
                          sx={{
                            bgcolor: idx % 2 === 0
                              ? "transparent"
                              : isDark
                              ? alpha(theme.palette.action.hover, 0.04)
                              : alpha(theme.palette.action.hover, 0.03),
                            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, py: 1.25, whiteSpace: "nowrap" }}>
                            {formatGameDateShort(d.date, tz)}
                          </TableCell>

                          <TableCell sx={{ color: "text.secondary", py: 1.25 }}>
                            {formatDayOfWeek(d.date, tz)}
                          </TableCell>

                          <TableCell sx={{ color: "text.secondary", py: 1.25 }}>
                            {d.timeWindow ?? (
                              <Typography component="span" variant="caption" color="text.disabled">
                                Time TBD
                              </Typography>
                            )}
                          </TableCell>

                          {showActions && (
                            <TableCell align="right" sx={{ py: 1.25, pr: 1.5 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => setCheckModal({ date: d.date })}
                                sx={{
                                  textTransform: "none",
                                  fontWeight:     700,
                                  fontSize:       "0.75rem",
                                  whiteSpace:     "nowrap",
                                  boxShadow:      0,
                                }}
                              >
                                Check Availability
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {checkModal && selectedCombo && (
        <CheckAvailabilityModal
          open
          onClose={() => setCheckModal(null)}
          schedulePostId={selectedCombo.postId}
          availableDate={checkModal.date}
          timezone={tz}
          schoolName={schoolName}
          sport={selectedCombo.sport}
          level={selectedCombo.level}
          gender={selectedCombo.gender}
        />
      )}
    </>
  );
}
