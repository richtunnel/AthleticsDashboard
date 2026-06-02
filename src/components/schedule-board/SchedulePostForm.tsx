"use client";

import { useState } from "react";
import {
  Box, Button, Card, CardContent, Typography, Select, MenuItem,
  FormControl, InputLabel, Stack, CircularProgress, Alert,
  Switch, FormControlLabel, Chip, Divider, IconButton, Tooltip,
  TextField,
} from "@mui/material";
import CalendarMonthIcon  from "@mui/icons-material/CalendarMonth";
import UploadFileIcon     from "@mui/icons-material/UploadFile";
import OpenInNewIcon      from "@mui/icons-material/OpenInNew";
import WeekendIcon        from "@mui/icons-material/Weekend";
import AddIcon            from "@mui/icons-material/Add";
import CloseIcon          from "@mui/icons-material/Close";
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
  key:    string;   // "sport|level|gender"
  sport:  string;
  level:  string;
  gender: string;
  label:  string;
}

export function SchedulePostForm({ onPosted }: Props) {
  const queryClient         = useQueryClient();
  const { addNotification } = useNotifications();

  const [workbookId,      setWorkbookId]      = useState("");
  const [comboKey,        setComboKey]        = useState("");
  const [title,           setTitle]           = useState("");
  const [description,     setDescription]     = useState("");
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [excludedDates,   setExcludedDates]   = useState<string[]>([]);
  const [addingDate,      setAddingDate]      = useState<Date | null>(null);
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

  const selectedCombo = combos.find((c) => c.key === comboKey);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedCombo) throw new Error("No sport selected");
      return fetch("/api/schedule-board", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          workbookId,
          sport:          selectedCombo.sport,
          level:          selectedCombo.level,
          gender:         selectedCombo.gender,
          title:          title.trim()       || null,
          description:    description.trim() || null,
          excludeWeekends,
          excludedDates,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to post schedule");
        return d;
      });
    },
    onSuccess: () => {
      addNotification("Your schedule has been posted to the Exchange Board!", "success");
      queryClient.invalidateQueries({ queryKey: ["schedule-board"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-schools"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-filters"] });
      setDuplicateErr(false);
      setComboKey("");
      setTitle("");
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

  const valid = !!workbookId && !!comboKey && !!selectedCombo;

  const addExcludedDate = (d: Date | null) => {
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    if (!excludedDates.includes(key)) setExcludedDates((prev) => [...prev, key].sort());
    setAddingDate(null);
  };

  const removeExcludedDate = (key: string) =>
    setExcludedDates((prev) => prev.filter((d) => d !== key));

  const formatExcluded = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

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
            Select a worksheet and sport. We'll scan your schedule, find every date
            that isn't already booked for that sport, and publish those open dates to
            the Exchange Board so other ADs can request a game.
          </Typography>

          {/* No worksheets — prompt to import */}
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
                Import your game schedule in Game Center first, then come back to post your open dates.
              </Typography>
            </Alert>
          )}

          {duplicateErr && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setDuplicateErr(false)}>
              You already have an active post for this sport. It has been updated with your latest selections.
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
                onChange={(e) => { setWorkbookId(e.target.value); setComboKey(""); }}
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
                  <MenuItem
                    component={NextLink}
                    href="/dashboard/games"
                    sx={{ gap: 1, color: "primary.main" }}
                  >
                    <UploadFileIcon fontSize="small" />
                    No Worksheet — Upload Schedule →
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            {/* ── Single sport + level + gender combo dropdown ── */}
            <FormControl
              size="small"
              fullWidth
              disabled={!workbookId || loadingCombos}
            >
              <InputLabel shrink>Choose a league</InputLabel>
              <Select
                displayEmpty
                notched
                value={comboKey}
                label="Choose a league"
                onChange={(e) => setComboKey(e.target.value)}
                renderValue={(val) => {
                  if (!workbookId)       return "Select a worksheet first";
                  if (loadingCombos)     return "Loading…";
                  if (!hasCombos)        return "No sports found in this worksheet";
                  if (!val)              return "Select sport";
                  return combos.find((c) => c.key === val)?.label ?? val;
                }}
              >
                {!workbookId ? (
                  <MenuItem disabled value="">Select a worksheet first</MenuItem>
                ) : loadingCombos ? (
                  <MenuItem disabled value="">Loading sports…</MenuItem>
                ) : !hasCombos ? (
                  <MenuItem disabled value="">
                    No sports found — check that your worksheet has game data
                  </MenuItem>
                ) : (
                  combos.map((c) => (
                    <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* ── Title + Description (shown once a combo is selected) ── */}
            {selectedCombo && (
              <>
                <TextField
                  size="small"
                  label="Post title (optional)"
                  placeholder={`${selectedCombo.label} — open dates`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  inputProps={{ maxLength: 80 }}
                  InputLabelProps={{ shrink: true }}
                  helperText={`${title.length}/80 — shown on your card in the Exchange Board`}
                  fullWidth
                />
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
              </>
            )}

            {/* ── Date exclusion controls (shown once a combo is selected) ── */}
            {selectedCombo && (
              <>
                <Divider />

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
                    sx={{ mb: 1 }}
                  />

                  {/* Hidden specific dates */}
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                    Hide specific dates
                  </Typography>

                  <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
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

                    {/* Add date button + inline picker */}
                    {addingDate !== undefined && (
                      <DatePicker
                        label="Hide date"
                        value={addingDate}
                        onChange={addExcludedDate}
                        onClose={() => setAddingDate(null)}
                        slotProps={{
                          textField: {
                            size: "small",
                            sx: { width: 160 },
                            InputLabelProps: { shrink: true },
                          },
                        }}
                      />
                    )}

                    <Tooltip title="Hide a specific date">
                      <Chip
                        icon={<AddIcon sx={{ fontSize: "0.85rem !important" }} />}
                        label="Add date"
                        size="small"
                        variant="outlined"
                        onClick={() => setAddingDate(null)}
                        sx={{ fontSize: "0.7rem", cursor: "pointer" }}
                      />
                    </Tooltip>
                  </Stack>
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
                {mutation.isPending ? "Posting…" : "Post to Schedule Board"}
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
