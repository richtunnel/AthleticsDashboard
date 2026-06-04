"use client";

import { useState } from "react";
import {
  Box, Button, Card, CardContent, Typography, Select, MenuItem,
  FormControl, InputLabel, Stack, CircularProgress, Alert,
  Switch, FormControlLabel, Chip, Divider, Checkbox, ListItemText,
  TextField,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import UploadFileIcon    from "@mui/icons-material/UploadFile";
import OpenInNewIcon     from "@mui/icons-material/OpenInNew";
import WeekendIcon       from "@mui/icons-material/Weekend";
import CloseIcon         from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns }       from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker }           from "@mui/x-date-pickers/DatePicker";
import NextLink from "next/link";

interface Props {
  onPosted?: () => void;
}

interface Combo {
  key:    string;
  sport:  string;
  level:  string;
  gender: string;
  label:  string;
}

export function SchedulePostForm({ onPosted }: Props) {
  const theme               = useTheme();
  const queryClient         = useQueryClient();
  const { addNotification } = useNotifications();

  const [workbookId,      setWorkbookId]      = useState("");
  const [selectedKeys,    setSelectedKeys]    = useState<string[]>([]);   // multi-select
  const [description,     setDescription]     = useState("");
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [excludedDates,   setExcludedDates]   = useState<string[]>([]);
  const [duplicateErr,    setDuplicateErr]    = useState(false);

  // Workbooks list
  const { data: workbooksData, isLoading: loadingWorkbooks } = useQuery({
    queryKey:  ["workbooks"],
    queryFn:   () =>
      fetch("/api/games-workbooks").then((r) => r.json()) as Promise<{
        data: { id: string; name: string }[];
      }>,
    staleTime: 60_000,
  });
  const workbooks    = workbooksData?.data ?? [];
  const hasWorkbooks = workbooks.length > 0;

  // Sport combos from selected workbook's actual games
  const { data: combosData, isLoading: loadingCombos } = useQuery({
    queryKey:  ["workbook-sports", workbookId],
    queryFn:   () =>
      fetch(`/api/schedule-board/workbook-sports?workbookId=${workbookId}`)
        .then((r) => r.json()) as Promise<{ combos: Combo[] }>,
    enabled:   !!workbookId,
    staleTime: 60_000,
  });
  const combos    = combosData?.combos ?? [];
  const hasCombos = combos.length > 0;

  const selectedCombos = combos.filter((c) => selectedKeys.includes(c.key));
  const hasSelections  = selectedCombos.length > 0;

  // Post one request per selected league (upsert on server)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!hasSelections) throw new Error("No leagues selected");
      const results = await Promise.all(
        selectedCombos.map((combo) =>
          fetch("/api/schedule-board", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              workbookId,
              sport:          combo.sport,
              level:          combo.level,
              gender:         combo.gender,
              description:    description.trim() || null,
              excludeWeekends,
              excludedDates,
            }),
          }).then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Failed to post schedule");
            return d;
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      const count = selectedCombos.length;
      addNotification(
        count === 1
          ? "Your schedule has been posted to the Exchange Board!"
          : `${count} leagues posted to the Exchange Board!`,
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["schedule-board"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-schools"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-filters"] });
      setDuplicateErr(false);
      setSelectedKeys([]);
      setDescription("");
      setExcludeWeekends(false);
      setExcludedDates([]);
      onPosted?.();
    },
    onError: (err: Error) => {
      if (err.message?.toLowerCase().includes("already")) setDuplicateErr(true);
      else addNotification(err.message, "error");
    },
  });

  // ── Date exclusion helpers ──────────────────────────────────────────────────
  const addExcludedDate = (d: Date | null) => {
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    if (!excludedDates.includes(key)) {
      setExcludedDates((prev) => [...prev, key].sort());
    }
  };

  const removeExcludedDate = (key: string) =>
    setExcludedDates((prev) => prev.filter((d) => d !== key));

  const formatExcluded = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });

  // Separator color: slightly stronger than "divider" so it's visible
  const dividerSx = {
    borderColor:       theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.18)"
      : "rgba(0,0,0,0.18)",
    borderBottomWidth: "1px",
  };

  const valid = !!workbookId && hasSelections;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <CalendarMonthIcon color="primary" />
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: "1rem", sm: "1.1rem" } }}>
              Post Your Open Schedule
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Select a worksheet and one or more leagues. We'll scan your schedule, find every
            unbooked date per league, and publish them to the Exchange Board.
          </Typography>

          {/* No worksheets */}
          {!loadingWorkbooks && !hasWorkbooks && (
            <Alert
              severity="info"
              icon={<UploadFileIcon fontSize="small" />}
              sx={{ mb: 2 }}
              action={
                <Button
                  component={NextLink}
                  href="/dashboard/games"
                  size="small"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  Import Schedule
                </Button>
              }
            >
              <Typography variant="body2" fontWeight={600}>No worksheet yet</Typography>
              <Typography variant="caption" color="text.secondary">
                Import your game schedule in Game Center first.
              </Typography>
            </Alert>
          )}

          {duplicateErr && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setDuplicateErr(false)}>
              One or more leagues already had active posts — they've been updated with your latest settings.
            </Alert>
          )}

          <Stack spacing={2}>
            {/* ── Worksheet ── */}
            <FormControl size="small" fullWidth disabled={!hasWorkbooks}>
              <InputLabel shrink>Worksheet</InputLabel>
              <Select
                displayEmpty
                notched
                value={workbookId}
                label="Worksheet"
                onChange={(e) => { setWorkbookId(e.target.value); setSelectedKeys([]); }}
                renderValue={(val) =>
                  val
                    ? workbooks.find((w) => w.id === val)?.name ?? val
                    : !hasWorkbooks
                    ? "No worksheet — import one first"
                    : "Select a worksheet"
                }
              >
                {hasWorkbooks ? (
                  workbooks.map((wb) => (
                    <MenuItem key={wb.id} value={wb.id}>{wb.name}</MenuItem>
                  ))
                ) : (
                  <MenuItem component={NextLink} href="/dashboard/games" sx={{ gap: 1, color: "primary.main" }}>
                    <UploadFileIcon fontSize="small" />
                    No Worksheet — Upload Schedule →
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            {/* ── Multi-select leagues ── */}
            <FormControl size="small" fullWidth disabled={!workbookId || loadingCombos}>
              <InputLabel shrink>Choose leagues</InputLabel>
              <Select
                multiple
                displayEmpty
                notched
                value={selectedKeys}
                label="Choose leagues"
                onChange={(e) => setSelectedKeys(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : e.target.value as string[]
                )}
                renderValue={(selected) => {
                  if (!workbookId)        return "Select a worksheet first";
                  if (loadingCombos)      return "Loading…";
                  if (!hasCombos)         return "No sports found in this worksheet";
                  if (!selected.length)   return "Select one or more leagues";
                  return combos
                    .filter((c) => selected.includes(c.key))
                    .map((c) => c.label)
                    .join(", ");
                }}
              >
                {!workbookId ? (
                  <MenuItem disabled value="">Select a worksheet first</MenuItem>
                ) : loadingCombos ? (
                  <MenuItem disabled value="">Loading…</MenuItem>
                ) : !hasCombos ? (
                  <MenuItem disabled value="">No sports found in this worksheet</MenuItem>
                ) : (
                  combos.map((c) => (
                    <MenuItem key={c.key} value={c.key} sx={{ py: 0.75 }}>
                      <Checkbox
                        size="small"
                        checked={selectedKeys.includes(c.key)}
                        sx={{ p: 0.5, mr: 0.5 }}
                      />
                      <ListItemText
                        primary={c.label}
                        primaryTypographyProps={{ fontSize: "0.875rem" }}
                      />
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* ── Description (only shown when leagues are selected) ── */}
            {hasSelections && (
              <TextField
                size="small"
                label="Description (optional)"
                placeholder="e.g. Preferred game times, travel notes, contact info…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                minRows={2}
                maxRows={5}
                inputProps={{ maxLength: 300 }}
                InputLabelProps={{ shrink: true }}
                helperText={`${description.length}/300 — visible to other ADs when they view your schedule`}
                fullWidth
              />
            )}

            {/* ── Date exclusion controls ── */}
            {hasSelections && (
              <>
                <Divider sx={dividerSx} />

                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
                    Customize Available Dates (optional)
                  </Typography>

                  {/* Exclude weekends toggle */}
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={excludeWeekends}
                        onChange={(e) => setExcludeWeekends(e.target.checked)}
                      />
                    }
                    label={
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <WeekendIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        <Typography variant="body2">Exclude weekends</Typography>
                      </Stack>
                    }
                    sx={{ mb: 1.5 }}
                  />

                  {/* Hide Dates — pick from calendar, auto-add on select */}
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
                    Hide Dates
                  </Typography>

                  {/* Hidden date chips */}
                  {excludedDates.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
                      {excludedDates.map((iso) => (
                        <Chip
                          key={iso}
                          label={formatExcluded(iso)}
                          size="small"
                          variant="outlined"
                          onDelete={() => removeExcludedDate(iso)}
                          deleteIcon={<CloseIcon sx={{ fontSize: "0.75rem !important" }} />}
                          sx={{ fontSize: "0.7rem" }}
                        />
                      ))}
                    </Stack>
                  )}

                  {/* Calendar picker — date auto-saved on selection, no extra button */}
                  <DatePicker
                    label="Pick a date to hide"
                    value={null}
                    onChange={addExcludedDate}
                    slotProps={{
                      textField: {
                        size:  "small",
                        sx:    { maxWidth: 220 },
                        InputLabelProps: { shrink: true },
                        helperText: "Click a date to hide it from your posted availability",
                      },
                    }}
                  />
                </Box>
              </>
            )}

            {/* ── Submit ── */}
            {hasWorkbooks ? (
              <Button
                variant="contained"
                disabled={!valid || mutation.isPending}
                onClick={() => mutation.mutate()}
                startIcon={
                  mutation.isPending
                    ? <CircularProgress size={14} color="inherit" />
                    : <CalendarMonthIcon />
                }
                sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700 }}
              >
                {mutation.isPending
                  ? "Posting…"
                  : `Post ${selectedCombos.length > 1 ? `${selectedCombos.length} Leagues` : "to Schedule Board"}`}
              </Button>
            ) : (
              <Button
                component={NextLink}
                href="/dashboard/games"
                variant="contained"
                startIcon={<UploadFileIcon />}
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700 }}
              >
                Go to Game Center to Import Schedule
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
}
