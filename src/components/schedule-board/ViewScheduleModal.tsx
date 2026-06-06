"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, IconButton,
  FormControl, InputLabel, Select, MenuItem,
  Typography, Box, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper,
  Button, Chip, Stack, CircularProgress, Divider,
  TextField, Tooltip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon          from "@mui/icons-material/Close";
import CalendarTodayIcon  from "@mui/icons-material/CalendarToday";
import AddIcon            from "@mui/icons-material/Add";
import DeleteOutlineIcon  from "@mui/icons-material/DeleteOutline";
import EditCalendarIcon   from "@mui/icons-material/EditCalendar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatGameDateShort,
  formatDayOfWeek,
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
  source:     "computed" | "manual";
}

export function ViewScheduleModal({
  open, onClose,
  schoolName, teamName, ownerName, city,
  combos, isOwnPost,
}: Props) {
  const theme           = useTheme();
  const isDark          = theme.palette.mode === "dark";
  const queryClient     = useQueryClient();

  const [selectedPostId, setSelectedPostId] = useState<string>(combos[0]?.postId ?? "");
  const [checkModal,     setCheckModal]     = useState<{ date: string } | null>(null);

  // Edit mode state
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

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

  const patchMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`/api/schedule-board/${selectedPostId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-board-dates", selectedPostId] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board"] });
    },
  });

  const handleAddDate = () => {
    if (!newDate) return;
    patchMutation.mutate({
      addDate: { date: newDate, timeWindow: newTime.trim() || null },
    });
    setNewDate("");
    setNewTime("");
  };

  const handleRemoveDate = (date: string) => {
    patchMutation.mutate({ removeDate: date });
  };

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
                {isOwnPost && (
                  <Chip
                    icon={<EditCalendarIcon sx={{ fontSize: "0.85rem !important" }} />}
                    label="Your schedule"
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Stack>

              {loadingDates ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                  <CircularProgress size={28} />
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
                    maxHeight: isOwnPost ? 360 : 420,
                    overflowY: "auto",
                  }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {["Date", "Day", "Time", ...(showActions ? [""] : []), ...(isOwnPost ? [""] : [])].map((h, i) => (
                          <TableCell
                            key={i}
                            sx={{
                              "&&": { backgroundColor: headerBg },
                              color:         "#fff",
                              fontWeight:    700,
                              fontSize:      "0.72rem",
                              letterSpacing: 0.5,
                              borderBottom:  "none",
                              py:            1.25,
                              whiteSpace:    "nowrap",
                            }}
                          >
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {dates.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={isOwnPost ? 4 : showActions ? 4 : 3}
                            sx={{ textAlign: "center", py: 5, color: "text.secondary" }}
                          >
                            <CalendarTodayIcon sx={{ fontSize: 40, mb: 1, display: "block", mx: "auto", opacity: 0.3 }} />
                            <Typography variant="body2">
                              No open dates yet.{isOwnPost ? " Add one below." : ""}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        dates.map((d, idx) => (
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
                              {d.source === "manual" && (
                                <Chip label="added" size="small" sx={{ ml: 1, height: 16, fontSize: "0.6rem", opacity: 0.6 }} />
                              )}
                            </TableCell>

                            <TableCell sx={{ color: "text.secondary", py: 1.25 }}>
                              {d.dayOfWeek}
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
                                    fontWeight:    700,
                                    fontSize:      "0.75rem",
                                    whiteSpace:    "nowrap",
                                    boxShadow:     0,
                                  }}
                                >
                                  Check Availability
                                </Button>
                              </TableCell>
                            )}

                            {isOwnPost && (
                              <TableCell align="right" sx={{ py: 0.5, pr: 1 }}>
                                <Tooltip title="Remove this date">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={patchMutation.isPending}
                                    onClick={() => handleRemoveDate(d.date)}
                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Add date form — only for the AD's own post */}
              {isOwnPost && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark ? alpha(theme.palette.primary.main, 0.04) : alpha(theme.palette.primary.main, 0.03),
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1.25, letterSpacing: 0.4 }}>
                    ADD AVAILABLE DATE
                  </Typography>
                  <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
                    <TextField
                      type="date"
                      size="small"
                      label="Date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ minWidth: 160 }}
                    />
                    <TextField
                      size="small"
                      label="Time (optional)"
                      placeholder="e.g. 4:00 PM"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      sx={{ minWidth: 150 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={patchMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                      onClick={handleAddDate}
                      disabled={!newDate || patchMutation.isPending}
                      sx={{ textTransform: "none", boxShadow: 0, whiteSpace: "nowrap" }}
                    >
                      Add Date
                    </Button>
                  </Stack>
                </Box>
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
