"use client";

import { useState, useMemo } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Select, Typography, Stack,
  FormControl, InputLabel, Chip,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface Game {
  customFields?: Record<string, any> | null;
  customData?:   Record<string, any> | null;
}

interface Props {
  games:      Game[];
  workbookId: string | null;
  onSelect:   (columnKey: string) => void;
  onDismiss:  () => void;
}

// Columns that are clearly NOT opponent names — skip these
const NON_OPPONENT_COLS = new Set([
  "date", "time", "sport", "level", "gender", "home", "away", "location",
  "venue", "status", "notes", "bus", "travel", "cost", "score",
  "home/away", "h/a", "departure", "arrival", "season",
]);

function isLikelyOpponentCol(key: string, sampleVal: string): number {
  const k = key.toLowerCase();
  const v = (sampleVal ?? "").toLowerCase();

  // Score-based: higher = more likely
  let score = 0;

  const highKeywords = ["opponent", "vs.", "versus", "away team", "visiting", "visitor",
    "opposing", "other team", "away school", "road team", "opp"];
  const medKeywords  = ["vs", "away", "rival", "team", "school", "club", "competition",
    "against", "foe", "adversary", "opponent school", "opponent name", "road"];

  if (highKeywords.some((kw) => k.includes(kw))) score += 10;
  if (medKeywords.some((kw) => k === kw))          score += 5;
  if (medKeywords.some((kw) => k.includes(kw)))    score += 3;

  // Penalise clearly non-opponent columns
  if (NON_OPPONENT_COLS.has(k)) score -= 20;

  // Values that look like school/team names bump score
  if (v && v !== "tbd" && v !== "" && !/^\d{1,2}[\/:]\d{1,2}/.test(v)) score += 2;

  return score;
}

export function AwayTeamColumnSelector({ games, workbookId, onSelect, onDismiss }: Props) {
  const [open,   setOpen]   = useState(false);
  const [picked, setPicked] = useState("");

  // Build column list: name → first non-empty sample value
  const columns = useMemo(() => {
    const map = new Map<string, string>();
    for (const game of games) {
      const raw = (game.customFields ?? game.customData ?? {}) as Record<string, any>;
      for (const [key, val] of Object.entries(raw)) {
        if (!map.has(key) && val != null && String(val).trim()) {
          map.set(key, String(val).trim());
        }
      }
    }

    return Array.from(map.entries())
      .map(([key, sample]) => ({ key, sample, score: isLikelyOpponentCol(key, sample) }))
      .filter(({ score }) => score > -5) // drop obviously wrong columns
      .sort((a, b) => b.score - a.score);
  }, [games]);

  const handleConfirm = () => {
    if (picked) {
      onSelect(picked);
      setOpen(false);
    }
  };

  return (
    <>
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon fontSize="small" />}
        onClose={onDismiss}
        sx={{ mb: 2, alignItems: "flex-start" }}
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={() => setOpen(true)}
            sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap", ml: 1 }}
          >
            Select Column
          </Button>
        }
      >
        <Typography variant="body2" fontWeight={600}>Some opponents show as TBD</Typography>
        <Typography variant="caption" color="text.secondary">
          Choose which column from your worksheet contains the away team / opponent names.
        </Typography>
      </Alert>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Select Opponent Column</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick the column that contains your away team or opponent names.
            The sample value shown is from the first game that has data in that column.
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel shrink>Column name</InputLabel>
            <Select
              displayEmpty
              notched
              value={picked}
              label="Column name"
              onChange={(e) => setPicked(e.target.value)}
            >
              <MenuItem value="" disabled>Select a column…</MenuItem>
              {columns.map(({ key, sample }) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }} gap={1}>
                    <Typography variant="body2" fontWeight={600} noWrap>{key}</Typography>
                    <Chip
                      label={sample.length > 22 ? sample.slice(0, 22) + "…" : sample}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.65rem", maxWidth: 140, flexShrink: 0 }}
                    />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {columns.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              No extra columns found in this worksheet. Make sure your CSV was imported with column data.
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setOpen(false)} variant="outlined" size="small" sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            size="small"
            disabled={!picked}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
