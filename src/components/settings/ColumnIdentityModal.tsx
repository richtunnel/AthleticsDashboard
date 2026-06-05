"use client";

import { useState, useEffect } from "react";
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Select, MenuItem, FormControl, InputLabel, Stack,
  Chip, Divider, IconButton, Tooltip,
} from "@mui/material";
import { Close, Tune, InfoOutlined } from "@mui/icons-material";
import { useOpponentColumnStore } from "@/lib/stores/opponentColumnStore";
import { useGamesWorkbookStore } from "@/lib/stores/gamesWorkbookStore";

export function ColumnIdentityModal() {
  const [open, setOpen] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});

  const { workbooks } = useGamesWorkbookStore();
  const { overrides, setOverride, clearOverride, columnRegistry } = useOpponentColumnStore();

  useEffect(() => {
    if (open) {
      setLocalOverrides({ ...overrides });
    }
  }, [open, overrides]);

  const handleSave = () => {
    for (const wbId of Object.keys(localOverrides)) {
      const val = localOverrides[wbId];
      if (val) {
        setOverride(wbId, val);
      } else if (overrides[wbId]) {
        clearOverride(wbId);
      }
    }
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Map your imported CSV column names to known data fields. When Opletics can't automatically identify a column — for example if your 'Away School' column isn't recognized as the opponent column — you can manually point it here.">
        <Button
          variant="outlined"
          startIcon={<Tune />}
          onClick={() => {
            setLocalOverrides({ ...overrides });
            setOpen(true);
          }}
          sx={{ textTransform: "none" }}
        >
          Identify Columns
        </Button>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700, pb: 1 }}>
          Column Identity
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close">
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {/* ── Opponent / Away Team Column ── */}
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Opponent / Away Team Column
            </Typography>
            <Tooltip title="This is the column in your imported CSV that contains opponent or away team names. If the auto-detection didn't pick it up, select it manually here.">
              <InfoOutlined sx={{ fontSize: 16, color: "text.secondary", cursor: "help" }} />
            </Tooltip>
          </Stack>

          {workbooks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No workbooks found. Import a CSV schedule first.
            </Typography>
          ) : (
            workbooks.map((wb) => {
              const columns = columnRegistry[wb.id] ?? [];
              const currentVal = localOverrides[wb.id] ?? "";
              const isMapped = !!overrides[wb.id];

              return (
                <Box key={wb.id} sx={{ mb: 2.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {wb.name}
                    </Typography>
                    {isMapped ? (
                      <Chip label="Mapped" size="small" color="info" sx={{ fontSize: "0.62rem", height: 18 }} />
                    ) : (
                      <Chip label="Auto-detected" size="small" variant="outlined" sx={{ fontSize: "0.62rem", height: 18 }} />
                    )}
                  </Stack>

                  {columns.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel shrink>Column name</InputLabel>
                      <Select
                        displayEmpty
                        notched
                        value={currentVal}
                        label="Column name"
                        onChange={(e) =>
                          setLocalOverrides((prev) => ({ ...prev, [wb.id]: e.target.value }))
                        }
                      >
                        <MenuItem value="">Use auto-detection</MenuItem>
                        {columns.map((col) => (
                          <MenuItem key={col} value={col}>
                            {col}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No columns discovered yet — open this workbook in Game Center first.
                    </Typography>
                  )}
                </Box>
              );
            })
          )}

          {/* ── Other Column Mappings (future) ── */}
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Other Column Mappings
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              (coming soon)
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Future updates will allow you to manually map Date, Time, and Home/Away columns.
          </Typography>

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip label="Date — Auto-detected" size="small" variant="outlined" sx={{ fontSize: "0.62rem", height: 20 }} />
            <Chip label="Time — Auto-detected" size="small" variant="outlined" sx={{ fontSize: "0.62rem", height: 20 }} />
            <Chip label="Home/Away — Auto-detected" size="small" variant="outlined" sx={{ fontSize: "0.62rem", height: 20 }} />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setOpen(false)} variant="outlined" size="small" sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
